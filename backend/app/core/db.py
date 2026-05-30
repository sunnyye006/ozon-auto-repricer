from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models import Base


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


STORE_ADDITIONS = {
    "auto_reprice_enabled": ("BOOLEAN NOT NULL DEFAULT TRUE", "BOOLEAN NOT NULL DEFAULT 1"),
    "auto_sync_interval_minutes": ("INTEGER NOT NULL DEFAULT 60", "INTEGER NOT NULL DEFAULT 60"),
    "scan_interval_minutes": ("INTEGER NOT NULL DEFAULT 10", "INTEGER NOT NULL DEFAULT 10"),
    "last_synced_at": ("TIMESTAMPTZ", "TIMESTAMP"),
    "last_scanned_at": ("TIMESTAMPTZ", "TIMESTAMP"),
    "owner_id": ("BIGINT", "INTEGER"),
}

PRODUCT_ADDITIONS = {
    "image_url": ("TEXT", "TEXT"),
    "platform": ("VARCHAR(20) NOT NULL DEFAULT 'Ozon'", "VARCHAR(20) NOT NULL DEFAULT 'Ozon'"),
}


async def run_migrations() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        dialect = conn.dialect.name

        if dialect == "postgresql":
            # 避免在已有锁（如旧容器卡住的事务）上无限等待 ALTER，快速失败而非挂死启动
            await conn.execute(text("SET lock_timeout = '5s'"))

        async def existing_columns(table: str) -> set[str]:
            if dialect == "postgresql":
                rows = await conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :table"
                    ),
                    {"table": table},
                )
                return {row[0] for row in rows.fetchall()}
            if dialect == "sqlite":
                rows = await conn.execute(text(f"PRAGMA table_info({table})"))
                return {row[1] for row in rows.fetchall()}
            return set()

        async def add_columns(table: str, defs: dict[str, tuple[str, str]]) -> None:
            existing = await existing_columns(table)
            for col, (pg_def, sqlite_def) in defs.items():
                if col in existing:
                    continue
                col_def = pg_def if dialect == "postgresql" else sqlite_def
                await conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
                )

        await add_columns("stores", STORE_ADDITIONS)
        await add_columns("products", PRODUCT_ADDITIONS)

        # price_events 随时间无限增长，给时间列加索引以支撑清理与按时间查询
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_price_events_created_at ON price_events (created_at)")
        )
