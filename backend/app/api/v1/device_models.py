import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.engineer_account_mapping import EngineerAccountMapping
from app.repositories.device_model_repo import DeviceModelRepository
from app.schemas.device_model import (
    DeviceModelCreate,
    DeviceModelList,
    DeviceModelRead,
    DeviceModelUpdate,
)

router = APIRouter(prefix="/device-models", tags=["device-models"])


async def _get_mapping(
    account_id: uuid.UUID, engineer_id: uuid.UUID, db: AsyncSession
) -> EngineerAccountMapping | None:
    result = await db.execute(
        select(EngineerAccountMapping).where(
            EngineerAccountMapping.engineer_id == engineer_id,
            EngineerAccountMapping.customer_account_id == account_id,
        )
    )
    return result.scalar_one_or_none()


@router.get("", response_model=DeviceModelList)
async def list_device_models(
    account_id: uuid.UUID = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.is_super_admin:
        mapping = await _get_mapping(account_id, user.id, db)
        if not mapping:
            raise ForbiddenError("You do not have access to this account")

    repo = DeviceModelRepository(db)
    items = await repo.get_by_account(account_id, skip, limit)
    total = await repo.count_by_account(account_id)
    return DeviceModelList(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=DeviceModelRead, status_code=201)
async def create_device_model(
    payload: DeviceModelCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.is_super_admin:
        mapping = await _get_mapping(payload.customer_account_id, user.id, db)
        if not mapping:
            raise ForbiddenError("You do not have access to this account")
        if not mapping.can_manage_models:
            raise ForbiddenError("Device Model Master permission required for this account")

    repo = DeviceModelRepository(db)
    existing = await repo.get_by_model_number(payload.model_number, payload.customer_account_id)
    if existing:
        raise ConflictError(
            f"Model number '{payload.model_number}' already exists for this account"
        )

    model = await repo.create(payload.model_dump())
    await db.commit()
    await db.refresh(model)
    return model


@router.get("/{model_id}", response_model=DeviceModelRead)
async def get_device_model(
    model_id: uuid.UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = DeviceModelRepository(db)
    model = await repo.get(model_id)
    if not model:
        raise NotFoundError(f"Device model {model_id} not found")

    if not user.is_super_admin:
        mapping = await _get_mapping(model.customer_account_id, user.id, db)
        if not mapping:
            raise ForbiddenError("You do not have access to this account")

    return model


@router.patch("/{model_id}", response_model=DeviceModelRead)
async def update_device_model(
    model_id: uuid.UUID,
    payload: DeviceModelUpdate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = DeviceModelRepository(db)
    model = await repo.get(model_id)
    if not model:
        raise NotFoundError(f"Device model {model_id} not found")

    if not user.is_super_admin:
        mapping = await _get_mapping(model.customer_account_id, user.id, db)
        if not mapping:
            raise ForbiddenError("You do not have access to this account")
        if not mapping.can_manage_models:
            raise ForbiddenError("Device Model Master permission required for this account")

    updated = await repo.update(model_id, payload.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(updated)
    return updated
