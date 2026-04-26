from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.keycloak import KeycloakAdmin
from app.db.session import get_db
from app.models.engineer_account_mapping import EngineerAccountMapping
from app.schemas.engineer import EngineerRead
from app.schemas.engineer_account_mapping import MappingRead

router = APIRouter(prefix="/auth", tags=["auth"])
kc_admin = KeycloakAdmin()


@router.get("/me", response_model=EngineerRead)
async def get_me(user=Depends(get_current_user)):
    return user


@router.get("/me/accounts", response_model=list[MappingRead])
async def get_my_accounts(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all account mappings for the currently authenticated engineer."""
    result = await db.execute(
        select(EngineerAccountMapping).where(
            EngineerAccountMapping.engineer_id == user.id
        )
    )
    return list(result.scalars().all())


@router.post("/password-reset/request", status_code=202)
async def request_password_reset(user=Depends(get_current_user)):
    await kc_admin.reset_password_email(user.keycloak_user_id)
    return {"message": "Password reset email sent"}
