import uuid
from datetime import datetime

from pydantic import BaseModel


class EngineerCreate(BaseModel):
    email: str
    full_name: str
    password: str
    is_super_admin: bool = False


class EngineerUpdate(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None
    is_super_admin: bool | None = None


class EngineerRead(BaseModel):
    id: uuid.UUID
    keycloak_user_id: str
    email: str
    full_name: str
    is_active: bool
    is_super_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EngineerList(BaseModel):
    items: list[EngineerRead]
    total: int
    skip: int
    limit: int
