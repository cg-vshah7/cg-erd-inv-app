from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class NotFoundError(Exception):
    def __init__(self, message: str = "Resource not found", details: Any = None) -> None:
        self.message = message
        self.details = details


class ConflictError(Exception):
    def __init__(self, message: str = "Resource conflict", details: Any = None) -> None:
        self.message = message
        self.details = details


class ForbiddenError(Exception):
    def __init__(self, message: str = "Access forbidden", details: Any = None) -> None:
        self.message = message
        self.details = details


class UnauthorizedError(Exception):
    def __init__(self, message: str = "Unauthorized", details: Any = None) -> None:
        self.message = message
        self.details = details


class ValidationError(Exception):
    def __init__(self, message: str = "Validation error", details: Any = None) -> None:
        self.message = message
        self.details = details


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "NOT_FOUND", "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(ConflictError)
    async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"error": {"code": "CONFLICT", "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(request: Request, exc: ForbiddenError) -> JSONResponse:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "FORBIDDEN", "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(UnauthorizedError)
    async def unauthorized_handler(request: Request, exc: UnauthorizedError) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"error": {"code": "UNAUTHORIZED", "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(request: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "VALIDATION_ERROR", "message": exc.message, "details": exc.details}},
        )
