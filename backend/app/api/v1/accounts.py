from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_super_admin
from app.core.exceptions import ConflictError, NotFoundError
from app.db.session import get_db
from app.repositories.customer_account_repo import CustomerAccountRepository
from app.schemas.common import PaginatedResponse
from app.schemas.customer_account import (
    CustomerAccountCreate,
    CustomerAccountRead,
    CustomerAccountUpdate,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=PaginatedResponse[CustomerAccountRead])
async def list_accounts(
    skip: int = 0,
    limit: int = 25,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = CustomerAccountRepository(db)
    items = await repo.get_multi(skip=skip, limit=limit)
    total = await repo.count()
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=CustomerAccountRead, status_code=201)
async def create_account(
    payload: CustomerAccountCreate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = CustomerAccountRepository(db)
    existing = await repo.get_by_name(payload.name)
    if existing:
        raise ConflictError(f"Account with name '{payload.name}' already exists")
    account = await repo.create(payload.model_dump())
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=CustomerAccountRead)
async def get_account(
    account_id: UUID,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = CustomerAccountRepository(db)
    account = await repo.get(account_id)
    if not account:
        raise NotFoundError(f"Account {account_id} not found")
    return account


@router.patch("/{account_id}", response_model=CustomerAccountRead)
async def update_account(
    account_id: UUID,
    payload: CustomerAccountUpdate,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = CustomerAccountRepository(db)
    account = await repo.update(account_id, payload.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: UUID,
    _user=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = CustomerAccountRepository(db)
    account = await repo.get(account_id)
    if not account:
        raise NotFoundError(f"Account {account_id} not found")
    await repo.update(account_id, {"is_active": False})
    await db.commit()
