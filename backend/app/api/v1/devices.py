import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.device import DeviceStatus
from app.models.engineer_account_mapping import EngineerAccountMapping
from app.repositories.device_repo import DeviceRepository
from app.schemas.common import PaginatedResponse
from app.schemas.device import CheckInRequest, DeviceListParams, DeviceRead
from app.services import device_service

router = APIRouter(prefix="/devices", tags=["devices"])


async def _get_engineer_account_ids(
    engineer_id: uuid.UUID, db: AsyncSession
) -> list[uuid.UUID]:
    result = await db.execute(
        select(EngineerAccountMapping.customer_account_id).where(
            EngineerAccountMapping.engineer_id == engineer_id
        )
    )
    return list(result.scalars().all())


@router.post("/checkin", response_model=DeviceRead, status_code=201)
async def check_in_device(
    payload: CheckInRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    device = await device_service.check_in(payload, user, db)
    return device


@router.get("", response_model=PaginatedResponse[DeviceRead])
async def list_devices(
    account_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.is_super_admin:
        if account_id:
            engineer_accounts = [account_id]
        else:
            from app.models.customer_account import CustomerAccount

            result = await db.execute(select(CustomerAccount.id))
            engineer_accounts = list(result.scalars().all())
    else:
        engineer_accounts = await _get_engineer_account_ids(user.id, db)
        if account_id:
            if account_id not in engineer_accounts:
                raise ForbiddenError("You do not have access to this account")
            engineer_accounts = [account_id]

    parsed_status = DeviceStatus(status) if status else None
    params = DeviceListParams(status=parsed_status, skip=skip, limit=limit)

    repo = DeviceRepository(db)
    items, total = await repo.get_scoped_devices(engineer_accounts, params)
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{device_id}", response_model=DeviceRead)
async def get_device(
    device_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = DeviceRepository(db)
    device = await repo.get(device_id)
    if not device:
        raise NotFoundError(f"Device {device_id} not found")

    if not user.is_super_admin:
        engineer_accounts = await _get_engineer_account_ids(user.id, db)
        if device.customer_account_id not in engineer_accounts:
            raise ForbiddenError("You do not have access to this device")

    return device
