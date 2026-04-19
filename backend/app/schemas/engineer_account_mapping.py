import uuid

from pydantic import BaseModel


class MappingCreate(BaseModel):
    customer_account_id: uuid.UUID
    can_manage_models: bool = False
    can_checkin_out: bool = False
    can_view_only: bool = True


class MappingUpdate(BaseModel):
    can_manage_models: bool | None = None
    can_checkin_out: bool | None = None
    can_view_only: bool | None = None


class MappingRead(BaseModel):
    id: uuid.UUID
    engineer_id: uuid.UUID
    customer_account_id: uuid.UUID
    can_manage_models: bool
    can_checkin_out: bool
    can_view_only: bool

    model_config = {"from_attributes": True}
