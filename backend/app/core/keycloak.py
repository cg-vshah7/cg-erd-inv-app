import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.exceptions import ConflictError

settings = get_settings()

_admin_token_cache: dict[str, Any] = {}


class KeycloakAdmin:
    def __init__(self) -> None:
        self._base_url = (
            f"{settings.KEYCLOAK_URL}/admin/realms/{settings.KEYCLOAK_REALM}"
        )

    async def get_admin_token(self) -> str:
        now = time.time()
        cached = _admin_token_cache.get("token")
        expires_at = _admin_token_cache.get("expires_at", 0.0)
        if cached and now < expires_at - 60:
            return cached
        token_url = (
            f"{settings.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
        )
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    "grant_type": "password",
                    "client_id": "admin-cli",
                    "username": settings.KEYCLOAK_ADMIN_USER,
                    "password": settings.KEYCLOAK_ADMIN_PASSWORD,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()
            token = data["access_token"]
            _admin_token_cache["token"] = token
            _admin_token_cache["expires_at"] = now + data.get("expires_in", 300)
            return token

    async def create_user(self, email: str, password: str, full_name: str) -> str:
        """Create a Keycloak user and return the new keycloak_user_id (UUID string)."""
        token = await self.get_admin_token()
        first_name, *rest = full_name.split(" ", 1)
        last_name = rest[0] if rest else ""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/users",
                json={
                    "email": email,
                    "username": email,
                    "firstName": first_name,
                    "lastName": last_name,
                    "enabled": True,
                    "emailVerified": True,
                    "credentials": [
                        {"type": "password", "value": password, "temporary": False}
                    ],
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            if response.status_code == 409:
                raise ConflictError(f"User with email {email} already exists in Keycloak")
            response.raise_for_status()
            # Location header: .../users/{new-user-id}
            location = response.headers.get("Location", "")
            keycloak_user_id = location.rstrip("/").split("/")[-1]
            return keycloak_user_id

    async def reset_password_email(self, user_id: str) -> None:
        """Trigger Keycloak's UPDATE_PASSWORD action email for the given user."""
        token = await self.get_admin_token()
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self._base_url}/users/{user_id}/execute-actions-email",
                json=["UPDATE_PASSWORD"],
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            response.raise_for_status()

    async def assign_realm_role(self, user_id: str, role_name: str) -> None:
        """Assign a realm-level role to a Keycloak user."""
        token = await self.get_admin_token()
        async with httpx.AsyncClient() as client:
            role_response = await client.get(
                f"{self._base_url}/roles/{role_name}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            role_response.raise_for_status()
            role = role_response.json()
            assign_response = await client.post(
                f"{self._base_url}/users/{user_id}/role-mappings/realm",
                json=[role],
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            assign_response.raise_for_status()
