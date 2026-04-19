from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer_account import CustomerAccount
from app.repositories.base import BaseRepository


class CustomerAccountRepository(BaseRepository[CustomerAccount]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CustomerAccount, db)

    async def get_by_name(self, name: str) -> CustomerAccount | None:
        result = await self.db.execute(
            select(CustomerAccount).where(CustomerAccount.name == name)
        )
        return result.scalar_one_or_none()

    async def count(self, **filters) -> int:
        query = select(func.count()).select_from(CustomerAccount)
        for field, value in filters.items():
            if hasattr(CustomerAccount, field) and value is not None:
                query = query.where(getattr(CustomerAccount, field) == value)
        result = await self.db.execute(query)
        return result.scalar_one()
