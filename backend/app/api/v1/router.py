from fastapi import APIRouter

from app.api.v1 import accounts, auth, engineers, locations

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(engineers.router)
api_router.include_router(locations.router)
