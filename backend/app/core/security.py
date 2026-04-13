import time
from typing import Any

import httpx
from fastapi import Request
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError

settings = get_settings()

_jwks_cache: dict[str, Any] = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600  # 1 hour


async def get_jwks() -> dict[str, Any]:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache
    jwks_url = (
        f"{settings.KEYCLOAK_URL}/realms/{settings.KEYCLOAK_REALM}"
        "/protocol/openid-connect/certs"
    )
    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url, timeout=10.0)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_fetched_at = now
        return _jwks_cache


class JWTValidator:
    async def _get_public_key(self, kid: str) -> Any:
        jwks = await get_jwks()
        for key in jwks.get("keys", []):
            if key["kid"] == kid:
                return key
        # Unknown kid — force refresh and retry once
        global _jwks_fetched_at
        _jwks_fetched_at = 0.0
        jwks = await get_jwks()
        for key in jwks.get("keys", []):
            if key["kid"] == kid:
                return key
        raise UnauthorizedError("Unknown token signing key")

    async def decode_token(self, token: str) -> dict[str, Any]:
        try:
            unverified_header = jwt.get_unverified_header(token)
        except JWTError as e:
            raise UnauthorizedError(f"Invalid token header: {e}")

        kid = unverified_header.get("kid")
        if not kid:
            raise UnauthorizedError("Token missing kid header")

        public_key = await self._get_public_key(kid)
        try:
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                # Keycloak tokens carry client_id as audience — skip aud verification here;
                # route-level guards enforce role/permission checks instead
                options={"verify_aud": False},
            )
            return payload
        except JWTError as e:
            raise UnauthorizedError(f"Token validation failed: {e}")


def get_token_from_header(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid Authorization header")
    return auth_header[len("Bearer "):]
