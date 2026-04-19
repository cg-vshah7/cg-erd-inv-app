import uuid
from datetime import datetime

from pydantic import BaseModel


class CustomerAccountCreate(BaseModel):
    name: str
    is_active: bool = True
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class CustomerAccountUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class CustomerAccountRead(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool
    contact_name: str | None
    contact_email: str | None
    contact_phone: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerAccountList(BaseModel):
    items: list[CustomerAccountRead]
    total: int
    skip: int
    limit: int
