import uuid
from typing import Optional

from pydantic import BaseModel

from app.models.location import LocationLevel


class LocationCreate(BaseModel):
    name: str
    level: LocationLevel
    parent_id: uuid.UUID | None = None
    customer_account_id: uuid.UUID
    is_active: bool = True


class LocationUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class LocationRead(BaseModel):
    id: uuid.UUID
    name: str
    level: LocationLevel
    parent_id: uuid.UUID | None
    customer_account_id: uuid.UUID
    is_active: bool
    children: Optional[list["LocationRead"]] = None

    model_config = {"from_attributes": True}


LocationRead.model_rebuild()


class LocationList(BaseModel):
    items: list[LocationRead]
    total: int
    skip: int
    limit: int
