from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.keycloak import KeycloakAdmin
from app.schemas.engineer import EngineerRead

router = APIRouter(prefix="/auth", tags=["auth"])
kc_admin = KeycloakAdmin()


@router.get("/me", response_model=EngineerRead)
async def get_me(user=Depends(get_current_user)):
    return user


@router.post("/password-reset/request", status_code=202)
async def request_password_reset(user=Depends(get_current_user)):
    await kc_admin.reset_password_email(user.keycloak_user_id)
    return {"message": "Password reset email sent"}
