import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_super_admin
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.repositories.location_repo import LocationRepository
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.services import location_service

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationRead])
async def list_locations(
    account_id: uuid.UUID = Query(...),
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = LocationRepository(db)
    items = await repo.get_multi(customer_account_id=account_id, is_active=True)
    return items


@router.get("/{location_id}/children", response_model=list[LocationRead])
async def get_children(
    location_id: uuid.UUID,
    account_id: uuid.UUID = Query(...),
    _user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = LocationRepository(db)
    children = await repo.get_children(location_id, account_id)
    return children


@router.post("", response_model=LocationRead, status_code=201)
async def create_location(
    payload: LocationCreate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = LocationRepository(db)
    location = await repo.create(payload.model_dump())
    await db.commit()
    await db.refresh(location)
    return location


@router.patch("/{location_id}", response_model=LocationRead)
async def update_location(
    location_id: uuid.UUID,
    payload: LocationUpdate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = LocationRepository(db)
    location = await repo.update(location_id, payload.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=204)
async def delete_location(
    location_id: uuid.UUID,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = LocationRepository(db)
    location = await repo.get(location_id)
    if not location:
        raise NotFoundError(f"Location {location_id} not found")
    await location_service.delete_location(location_id, db)
    await db.commit()
