from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.engineer import Engineer
from app.models.engineer_account_mapping import EngineerAccountMapping
from app.repositories.base import BaseRepository


class EngineerRepository(BaseRepository[Engineer]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Engineer, db)

    async def get_by_keycloak_id(self, kc_id: str) -> Engineer | None:
        result = await self.db.execute(
            select(Engineer).where(Engineer.keycloak_user_id == kc_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Engineer | None:
        result = await self.db.execute(
            select(Engineer).where(Engineer.email == email)
        )
        return result.scalar_one_or_none()

    async def get_with_mappings(self, engineer_id) -> Engineer | None:
        result = await self.db.execute(
            select(Engineer)
            .options(selectinload(Engineer.account_mappings))
            .where(Engineer.id == engineer_id)
        )
        return result.scalar_one_or_none()

    async def get_mappings(self, engineer_id) -> list[EngineerAccountMapping]:
        result = await self.db.execute(
            select(EngineerAccountMapping).where(
                EngineerAccountMapping.engineer_id == engineer_id
            )
        )
        return list(result.scalars().all())

    async def count(self, **filters) -> int:
        query = select(func.count()).select_from(Engineer)
        for field, value in filters.items():
            if hasattr(Engineer, field) and value is not None:
                query = query.where(getattr(Engineer, field) == value)
        result = await self.db.execute(query)
        return result.scalar_one()
