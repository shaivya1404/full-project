"""Async SQLAlchemy session for admin-api."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from admin_api.config import settings

# asyncpg driver: replace postgresql:// with postgresql+asyncpg://
_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(_url, pool_pre_ping=True, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[override]
    async with AsyncSessionLocal() as session:
        yield session
