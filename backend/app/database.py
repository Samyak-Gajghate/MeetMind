from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args={"statement_cache_size": 0, "ssl": "require"})
AsyncSessionLocal = async_sessionmaker(
    bind=engine, autoflush=False, autocommit=False, class_=AsyncSession
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
