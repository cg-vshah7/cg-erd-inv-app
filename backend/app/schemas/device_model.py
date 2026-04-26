import uuid

from pydantic import BaseModel


class DeviceModelCreate(BaseModel):
    customer_account_id: uuid.UUID
    model_number: str
    name: str
    description: str | None = None
    manufacturer: str | None = None
    device_category: str | None = None
    is_active: bool = True


class DeviceModelUpdate(BaseModel):
    model_number: str | None = None
    name: str | None = None
    description: str | None = None
    manufacturer: str | None = None
    device_category: str | None = None
    is_active: bool | None = None


class DeviceModelRead(BaseModel):
    id: uuid.UUID
    customer_account_id: uuid.UUID
    model_number: str
    name: str
    description: str | None
    manufacturer: str | None
    device_category: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class DeviceModelList(BaseModel):
    items: list[DeviceModelRead]
    total: int
    skip: int
    limit: int
