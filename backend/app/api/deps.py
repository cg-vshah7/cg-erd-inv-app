from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import JWTValidator
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)
jwt_validator = JWTValidator()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Validate JWT and return the corresponding Engineer record."""
    if not credentials:
        raise UnauthorizedError("Missing Authorization header")

    # Import here to avoid circular imports at module load time
    from app.models.engineer import Engineer

    payload = await jwt_validator.decode_token(credentials.credentials)
    keycloak_user_id = payload.get("sub")
    if not keycloak_user_id:
        raise UnauthorizedError("Token missing sub claim")

    result = await db.execute(
        select(Engineer).where(Engineer.keycloak_user_id == keycloak_user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("Engineer not found — contact your administrator")
    return user


async def require_super_admin(
    user=Depends(get_current_user),
):
    """Raise 403 if the current user does not have the super_admin flag."""
    if not user.is_super_admin:
        raise ForbiddenError("Super Admin access required")
    return user


async def require_account_access(
    account_id: UUID,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the EngineerAccountMapping for account_id, raise 403 if none found.

    account_id is resolved from the route path parameter (FastAPI injection).
    """
    from app.models.engineer_account_mapping import EngineerAccountMapping

    result = await db.execute(
        select(EngineerAccountMapping).where(
            EngineerAccountMapping.engineer_id == user.id,
            EngineerAccountMapping.customer_account_id == account_id,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise ForbiddenError("You do not have access to this account")
    return mapping


async def require_checkin_permission(
    mapping=Depends(require_account_access),
):
    """Raise 403 if the mapping does not grant check-in/out permission."""
    if not mapping.can_checkin_out:
        raise ForbiddenError("Check-in/out permission required for this account")
    return mapping


async def require_model_master_permission(
    mapping=Depends(require_account_access),
):
    """Raise 403 if the mapping does not grant device model management permission."""
    if not mapping.can_manage_models:
        raise ForbiddenError("Device Model Master permission required for this account")
    return mapping
