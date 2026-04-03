from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine.url import make_url
from app.config import settings
from app.core.db_diagnostics import log_database_target

if settings.DB_DIAGNOSTICS_ENABLED:
    log_database_target(settings.DATABASE_URL, label="API")

def _sanitize_database_url(raw_url: str) -> str:
    parsed_url = make_url(raw_url)
    clean_query = dict(parsed_url.query)
    clean_query.pop("sslmode", None)
    return str(parsed_url.set(query=clean_query))


database_url_for_engine = _sanitize_database_url(settings.DATABASE_URL)

engine = create_async_engine(
    database_url_for_engine,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=5,
    max_overflow=5,
    connect_args={
        # Required for pgbouncer transaction/session pool compatibility.
        "statement_cache_size": 0,
        "timeout": settings.DB_CONNECT_TIMEOUT_SEC,
        "ssl": True,
    },
)
AsyncSessionLocal = async_sessionmaker(
    bind=engine, autoflush=False, autocommit=False, class_=AsyncSession
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
