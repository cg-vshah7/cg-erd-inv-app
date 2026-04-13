from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No startup side effects — database migrations are run by the entrypoint script
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="CG ERD Inventory API",
        description="Asset inventory system for MedDevice/MedTech service engineers",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "ok"}

    # Prometheus metrics — exposed at /metrics
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    # API router is included here once routes are implemented (Phase 4+)
    # from app.api.v1.router import api_router
    # app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
