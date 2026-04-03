import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.config import settings
from app.core.db_diagnostics import log_database_target, preflight_database_network
from app.database import Base
from app.models import *

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
migration_database_url = settings.MIGRATION_DATABASE_URL or settings.DATABASE_URL

if settings.DB_DIAGNOSTICS_ENABLED:
    source = "MIGRATION_DATABASE_URL" if settings.MIGRATION_DATABASE_URL else "DATABASE_URL"
    log_database_target(migration_database_url, label=f"MIGRATIONS ({source})")

def run_migrations_offline() -> None:
    url = migration_database_url
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
    if settings.DB_DIAGNOSTICS_ENABLED:
        preflight_database_network(
            migration_database_url,
            label="MIGRATIONS",
            timeout_sec=settings.DB_CONNECT_TIMEOUT_SEC,
        )

    # Parse URL and remove sslmode from query params (asyncpg uses ssl= not sslmode=)
    from sqlalchemy.engine.url import make_url
    parsed_url = make_url(migration_database_url)
    if "sslmode" in parsed_url.query:
        parsed_url = parsed_url.update_query_dict({k: v for k, v in parsed_url.query.items() if k != "sslmode"})
        migration_url_for_engine = str(parsed_url)
    else:
        migration_url_for_engine = migration_database_url

    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = migration_url_for_engine

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={
            "statement_cache_size": 0,
            "timeout": settings.DB_CONNECT_TIMEOUT_SEC,
            "ssl": True,
        },
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
