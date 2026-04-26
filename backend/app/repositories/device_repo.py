import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device, DeviceStatus
from app.repositories.base import BaseRepository
from app.schemas.device import DeviceListParams


class DeviceRepository(BaseRepository[Device]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Device, db)

    async def get_checked_in_by_serial(
        self, serial: str, account_id: uuid.UUID
    ) -> Device | None:
        """Return the CHECKED_IN device for a given serial + account, or None."""
        result = await self.db.execute(
            select(Device).where(
                Device.serial_number == serial,
                Device.customer_account_id == account_id,
                Device.status == DeviceStatus.CHECKED_IN,
            )
        )
        return result.scalar_one_or_none()

    async def get_scoped_devices(
        self,
        engineer_accounts: list[uuid.UUID],
        params: DeviceListParams,
    ) -> tuple[list[Device], int]:
        """Return (devices, total) scoped to the given account IDs with all filters applied."""
        query = select(Device).where(Device.customer_account_id.in_(engineer_accounts))

        if params.account_id is not None:
            query = query.where(Device.customer_account_id == params.account_id)
        if params.status is not None:
            query = query.where(Device.status == params.status)
        if params.model_id is not None:
            query = query.where(Device.device_model_id == params.model_id)
        if params.serial_number is not None:
            query = query.where(Device.serial_number.ilike(f"%{params.serial_number}%"))
        if params.engineer_id is not None:
            query = query.where(
                or_(
                    Device.checked_in_by_id == params.engineer_id,
                    Device.checked_out_by_id == params.engineer_id,
                )
            )
        if params.location_id is not None:
            query = query.where(Device.location_id == params.location_id)
        if params.checked_in_after is not None:
            query = query.where(Device.checked_in_at >= params.checked_in_after)
        if params.checked_in_before is not None:
            query = query.where(Device.checked_in_at <= params.checked_in_before)
        if params.checked_out_after is not None:
            query = query.where(Device.checked_out_at >= params.checked_out_after)
        if params.checked_out_before is not None:
            query = query.where(Device.checked_out_at <= params.checked_out_before)

        count_query = select(func.count()).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        query = query.order_by(Device.checked_in_at.desc()).offset(params.skip).limit(params.limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total
