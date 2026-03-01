"""Admin API — Multi-tenant management service (port 8006)."""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from loguru import logger

# Make package importable as admin_api
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from admin_api.config import settings
from admin_api.routers import calls, companies, phone_numbers

app = FastAPI(
    title="Admin API",
    version="1.0.0",
    description="Multi-tenant management: Companies, PhoneNumbers, CallSessions",
)

PREFIX = "/admin/v1"
app.include_router(companies.router, prefix=PREFIX)
app.include_router(phone_numbers.router, prefix=PREFIX)
app.include_router(calls.router, prefix=PREFIX)


@app.get(f"{PREFIX}/health")
async def health() -> dict:
    return {"status": "ok", "service": "admin-api"}


@app.on_event("startup")
async def startup() -> None:
    logger.info("Admin API started on port {}", settings.admin_api_port)
