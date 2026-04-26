import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.location import Location
from app.repositories.location_repo import LocationRepository


async def delete_location(location_id: uuid.UUID, db: AsyncSession) -> None:
    repo = LocationRepository(db)
    location = await repo.get(location_id)
    if not location:
        raise NotFoundError(f"Location {location_id} not found")

    has_devices = await repo.has_active_devices(location_id)
    if has_devices:
        raise ConflictError(
            "Cannot delete location: active devices are currently assigned to it"
        )

    await repo.update(location_id, {"is_active": False})


async def get_location_path(location_id: uuid.UUID, db: AsyncSession) -> list[Location]:
    """Traverse parent chain and return path from root (SITE) to the given location."""
    repo = LocationRepository(db)
    path: list[Location] = []
    current_id: uuid.UUID | None = location_id

    while current_id is not None:
        location = await repo.get(current_id)
        if not location:
            break
        path.insert(0, location)
        current_id = location.parent_id

    return path
