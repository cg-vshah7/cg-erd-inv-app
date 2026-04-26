import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.device import DeviceCondition, DeviceStatus


class CheckInRequest(BaseModel):
    account_id: uuid.UUID
    serial_number: str
    device_model_id: uuid.UUID
    location_id: uuid.UUID
    asset_tag: str | None = None
    condition: DeviceCondition = DeviceCondition.GOOD
    checked_in_at: datetime
    comments: str | None = None


class CheckOutRequest(BaseModel):
    checked_out_at: datetime
    comments: str | None = None


class DeviceRead(BaseModel):
    id: uuid.UUID
    customer_account_id: uuid.UUID
    device_model_id: uuid.UUID
    serial_number: str
    asset_tag: str | None
    condition: DeviceCondition
    status: DeviceStatus
    location_id: uuid.UUID | None
    checked_in_by_id: uuid.UUID
    checked_out_by_id: uuid.UUID | None
    checked_in_at: datetime
    checked_out_at: datetime | None
    comments: str | None
    # enriched fields (populated when available)
    model_name: str | None = None
    model_number: str | None = None
    location_path: str | None = None
    checked_in_by_name: str | None = None
    checked_out_by_name: str | None = None

    model_config = {"from_attributes": True}


class DeviceUpdate(BaseModel):
    device_model_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    comments: str | None = None


class DeviceListParams(BaseModel):
    status: DeviceStatus | None = None
    account_id: uuid.UUID | None = None
    model_id: uuid.UUID | None = None
    serial_number: str | None = None
    engineer_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    checked_in_after: datetime | None = None
    checked_in_before: datetime | None = None
    checked_out_after: datetime | None = None
    checked_out_before: datetime | None = None
    skip: int = 0
    limit: int = 25
