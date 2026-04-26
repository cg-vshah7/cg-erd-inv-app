import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models.audit_log import AuditAction
from app.models.device import Device, DeviceStatus
from app.models.engineer import Engineer
from app.models.engineer_account_mapping import EngineerAccountMapping
from app.models.location import LocationLevel
from app.repositories.audit_log_repo import AuditLogRepository
from app.repositories.device_repo import DeviceRepository
from app.repositories.location_repo import LocationRepository
from app.schemas.device import CheckInRequest
from app.services import location_service


async def _require_checkin_permission(
    account_id: uuid.UUID, engineer: Engineer, db: AsyncSession
) -> None:
    """Verify engineer has can_checkin_out on the given account."""
    result = await db.execute(
        select(EngineerAccountMapping).where(
            EngineerAccountMapping.engineer_id == engineer.id,
            EngineerAccountMapping.customer_account_id == account_id,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise ForbiddenError("You do not have access to this account")
    if not mapping.can_checkin_out:
        raise ForbiddenError("Check-in/out permission required for this account")


async def check_in(request: CheckInRequest, engineer: Engineer, db: AsyncSession) -> Device:
    """Check in a device atomically — creates Device + AuditLog in a single commit."""
    # 1. Verify engineer has can_checkin_out on the account (super admin bypasses)
    if not engineer.is_super_admin:
        await _require_checkin_permission(request.account_id, engineer, db)

    # 2. Verify location exists and is ROOM level
    loc_repo = LocationRepository(db)
    location = await loc_repo.get(request.location_id)
    if not location:
        raise NotFoundError(f"Location {request.location_id} not found")
    if location.level != LocationLevel.ROOM:
        raise ValidationError("Device must be assigned to a ROOM-level location")

    # 3. Check for duplicate CHECKED_IN serial in this account
    device_repo = DeviceRepository(db)
    existing = await device_repo.get_checked_in_by_serial(
        request.serial_number, request.account_id
    )
    if existing:
        raise ConflictError(
            f"Device with serial number '{request.serial_number}' is already checked in "
            "for this account"
        )

    # 4. Create Device row with status=CHECKED_IN
    device = await device_repo.create(
        {
            "customer_account_id": request.account_id,
            "device_model_id": request.device_model_id,
            "serial_number": request.serial_number,
            "asset_tag": request.asset_tag,
            "condition": request.condition,
            "status": DeviceStatus.CHECKED_IN,
            "location_id": request.location_id,
            "checked_in_by_id": engineer.id,
            "checked_in_at": request.checked_in_at,
            "comments": request.comments,
        }
    )

    # 5. Build location_snapshot — full path from SITE to ROOM
    path = await location_service.get_location_path(request.location_id, db)
    location_snapshot = {
        "path": [
            {"id": str(loc.id), "name": loc.name, "level": loc.level.value}
            for loc in path
        ]
    }

    # 6. Insert AuditLog row with action=CHECK_IN
    audit_repo = AuditLogRepository(db)
    await audit_repo.insert(
        {
            "device_id": device.id,
            "customer_account_id": request.account_id,
            "action": AuditAction.CHECK_IN,
            "engineer_id": engineer.id,
            "location_id": request.location_id,
            "location_snapshot": location_snapshot,
            "comments": request.comments,
        }
    )

    # 7. Commit device + audit log atomically (satisfies SC-005)
    await db.commit()
    await db.refresh(device)
    return device
