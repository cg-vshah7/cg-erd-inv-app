import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ---------------------------------------------------------------------------
# App imports — Base metadata + all models must be imported here so that
# Alembic autogenerate can detect table changes.
# ---------------------------------------------------------------------------
from app.db.base import Base  # noqa: E402
from app.core.config import get_settings  # noqa: E402

# Model imports — add each model module here as they are created in later phases.
# Phase 4 (T038–T040):
from app.models import customer_account, engineer, engineer_account_mapping  # noqa: F401
# Phase 5 (T055):
# from app.models import location  # noqa: F401
# Phase 6 (T063):
# from app.models import device_model  # noqa: F401
# Phase 7 (T069–T070):
# from app.models import device, audit_log  # noqa: F401

# ---------------------------------------------------------------------------
# Alembic Config — provides access to values in alembic.ini
# ---------------------------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url from pydantic-settings (reads from .env)
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL script)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
