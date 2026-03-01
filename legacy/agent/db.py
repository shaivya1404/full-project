"""Shared async SQLAlchemy engine and session factory.

Imported by agent/agent.py (turn persistence) and agent/tools/db_tools.py
(direct tool SQL) so both share the same connection pool.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from agent.config import settings

_engine = create_async_engine(
    settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
    pool_pre_ping=True,
    echo=False,
)
SessionLocal = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
