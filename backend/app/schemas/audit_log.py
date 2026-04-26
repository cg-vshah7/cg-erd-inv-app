import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.audit_log import AuditAction


class AuditLogRead(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    customer_account_id: uuid.UUID
    action: AuditAction
    engineer_id: uuid.UUID
    location_id: uuid.UUID | None
    location_snapshot: dict[str, Any] | None
    comments: str | None
    event_at: datetime
    # enriched fields (populated when available)
    device_serial: str | None = None
    engineer_name: str | None = None

    model_config = {"from_attributes": True}


class AuditLogListParams(BaseModel):
    device_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    engineer_id: uuid.UUID | None = None
    action: AuditAction | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
    skip: int = 0
    limit: int = 25
