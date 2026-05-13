from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def normalize_database_url(database_url: str) -> str:
    """
    兼容旧配置：如果仍使用 asyncpg URL，自动切换到 psycopg 驱动。
    """
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    return database_url


normalized_database_url = normalize_database_url(settings.database_url)
if normalized_database_url.startswith("sqlite+aiosqlite:///./"):
    Path("./data").mkdir(parents=True, exist_ok=True)

engine = create_async_engine(normalized_database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
