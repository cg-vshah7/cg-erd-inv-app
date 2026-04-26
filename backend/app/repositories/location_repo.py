import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import Location, LocationLevel
from app.repositories.base import BaseRepository


class LocationRepository(BaseRepository[Location]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Location, db)

    async def get_children(self, parent_id: uuid.UUID, account_id: uuid.UUID) -> list[Location]:
        result = await self.db.execute(
            select(Location).where(
                Location.parent_id == parent_id,
                Location.customer_account_id == account_id,
                Location.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def get_sites(self, account_id: uuid.UUID) -> list[Location]:
        result = await self.db.execute(
            select(Location).where(
                Location.level == LocationLevel.SITE,
                Location.customer_account_id == account_id,
                Location.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def has_active_devices(self, location_id: uuid.UUID) -> bool:
        from sqlalchemy import text

        result = await self.db.execute(
            text(
                "SELECT COUNT(*) FROM devices WHERE location_id = :lid AND status = 'CHECKED_IN'"
            ),
            {"lid": str(location_id)},
        )
        count = result.scalar_one()
        return count > 0
