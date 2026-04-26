import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogListParams


class AuditLogRepository:
    """Insert-only repository for audit logs — no update or delete operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def insert(self, log_data: dict[str, Any]) -> AuditLog:
        log = AuditLog(**log_data)
        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)
        return log

    async def get_scoped_logs(
        self,
        engineer_accounts: list[uuid.UUID],
        params: AuditLogListParams,
    ) -> tuple[list[AuditLog], int]:
        """Return (logs, total) scoped to the given account IDs with filters applied."""
        query = select(AuditLog).where(AuditLog.customer_account_id.in_(engineer_accounts))

        if params.device_id is not None:
            query = query.where(AuditLog.device_id == params.device_id)
        if params.account_id is not None:
            query = query.where(AuditLog.customer_account_id == params.account_id)
        if params.engineer_id is not None:
            query = query.where(AuditLog.engineer_id == params.engineer_id)
        if params.action is not None:
            query = query.where(AuditLog.action == params.action)
        if params.from_date is not None:
            query = query.where(AuditLog.event_at >= params.from_date)
        if params.to_date is not None:
            query = query.where(AuditLog.event_at <= params.to_date)

        count_query = select(func.count()).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        query = (
            query.order_by(AuditLog.event_at.desc()).offset(params.skip).limit(params.limit)
        )
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total
