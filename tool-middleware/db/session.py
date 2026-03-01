"""Async SQLAlchemy session for tool-middleware."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from tool_middleware.config import settings

_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(_url, pool_pre_ping=True, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:  # type: ignore[override]
    async with AsyncSessionLocal() as session:
        yield session
