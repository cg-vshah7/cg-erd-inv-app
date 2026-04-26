import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_model import DeviceModel
from app.repositories.base import BaseRepository


class DeviceModelRepository(BaseRepository[DeviceModel]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(DeviceModel, db)

    async def get_by_account(
        self, account_id: uuid.UUID, skip: int = 0, limit: int = 100
    ) -> list[DeviceModel]:
        result = await self.db.execute(
            select(DeviceModel)
            .where(
                DeviceModel.customer_account_id == account_id,
                DeviceModel.is_active.is_(True),
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_model_number(
        self, model_number: str, account_id: uuid.UUID
    ) -> DeviceModel | None:
        result = await self.db.execute(
            select(DeviceModel).where(
                DeviceModel.model_number == model_number,
                DeviceModel.customer_account_id == account_id,
            )
        )
        return result.scalar_one_or_none()

    async def count_by_account(self, account_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).where(
                DeviceModel.customer_account_id == account_id,
                DeviceModel.is_active.is_(True),
            )
        )
        return result.scalar_one()
