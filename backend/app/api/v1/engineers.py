from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_super_admin
from app.core.exceptions import ConflictError, NotFoundError
from app.core.keycloak import KeycloakAdmin
from app.db.session import get_db
from app.models.engineer_account_mapping import EngineerAccountMapping
from app.repositories.engineer_repo import EngineerRepository
from app.schemas.common import PaginatedResponse
from app.schemas.engineer import EngineerCreate, EngineerRead, EngineerUpdate
from app.schemas.engineer_account_mapping import MappingCreate, MappingRead, MappingUpdate

router = APIRouter(prefix="/engineers", tags=["engineers"])
kc_admin = KeycloakAdmin()


@router.get("", response_model=PaginatedResponse[EngineerRead])
async def list_engineers(
    skip: int = 0,
    limit: int = 25,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EngineerRepository(db)
    items = await repo.get_multi(skip=skip, limit=limit)
    total = await repo.count()
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=EngineerRead, status_code=201)
async def create_engineer(
    payload: EngineerCreate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EngineerRepository(db)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise ConflictError(f"Engineer with email '{payload.email}' already exists")

    kc_user_id = await kc_admin.create_user(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    if payload.is_super_admin:
        await kc_admin.assign_realm_role(kc_user_id, "super_admin")

    engineer = await repo.create(
        {
            "keycloak_user_id": kc_user_id,
            "email": payload.email,
            "full_name": payload.full_name,
            "is_active": True,
            "is_super_admin": payload.is_super_admin,
        }
    )
    await db.commit()
    await db.refresh(engineer)
    return engineer


@router.get("/{engineer_id}", response_model=EngineerRead)
async def get_engineer(
    engineer_id: UUID,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EngineerRepository(db)
    engineer = await repo.get(engineer_id)
    if not engineer:
        raise NotFoundError(f"Engineer {engineer_id} not found")
    return engineer


@router.patch("/{engineer_id}", response_model=EngineerRead)
async def update_engineer(
    engineer_id: UUID,
    payload: EngineerUpdate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EngineerRepository(db)
    engineer = await repo.update(engineer_id, payload.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(engineer)
    return engineer


@router.get("/{engineer_id}/accounts", response_model=list[MappingRead])
async def get_engineer_accounts(
    engineer_id: UUID,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = EngineerRepository(db)
    return await repo.get_mappings(engineer_id)


@router.post("/{engineer_id}/accounts", response_model=MappingRead, status_code=201)
async def assign_account(
    engineer_id: UUID,
    payload: MappingCreate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EngineerAccountMapping).where(
            EngineerAccountMapping.engineer_id == engineer_id,
            EngineerAccountMapping.customer_account_id == payload.customer_account_id,
        )
    )
    if result.scalar_one_or_none():
        raise ConflictError("Engineer is already assigned to this account")

    mapping = EngineerAccountMapping(
        engineer_id=engineer_id,
        customer_account_id=payload.customer_account_id,
        can_manage_models=payload.can_manage_models,
        can_checkin_out=payload.can_checkin_out,
        can_view_only=payload.can_view_only,
    )
    db.add(mapping)
    await db.flush()
    await db.refresh(mapping)
    await db.commit()
    await db.refresh(mapping)
    return mapping


@router.patch("/{engineer_id}/accounts/{account_id}", response_model=MappingRead)
async def update_mapping(
    engineer_id: UUID,
    account_id: UUID,
    payload: MappingUpdate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EngineerAccountMapping).where(
            EngineerAccountMapping.engineer_id == engineer_id,
            EngineerAccountMapping.customer_account_id == account_id,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise NotFoundError("Engineer account mapping not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(mapping, field, value)
    await db.flush()
    await db.refresh(mapping)
    await db.commit()
    await db.refresh(mapping)
    return mapping


@router.delete("/{engineer_id}/accounts/{account_id}", status_code=204)
async def remove_mapping(
    engineer_id: UUID,
    account_id: UUID,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EngineerAccountMapping).where(
            EngineerAccountMapping.engineer_id == engineer_id,
            EngineerAccountMapping.customer_account_id == account_id,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise NotFoundError("Engineer account mapping not found")
    await db.delete(mapping)
    await db.commit()
