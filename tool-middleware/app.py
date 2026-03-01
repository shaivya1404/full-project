"""Tool Middleware — FastAPI service for Qwen tool execution (port 8005)."""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from loguru import logger

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tool_middleware.config import settings
from tool_middleware.routers import crm, faq, orders, products

app = FastAPI(
    title="Tool Middleware",
    version="1.0.0",
    description="Tool executor for Qwen — FAQ, CRM, Products, Orders",
)

app.include_router(faq.router)
app.include_router(crm.router)
app.include_router(products.router)
app.include_router(orders.router)


@app.get("/tools/health")
async def health() -> dict:
    return {"status": "ok", "service": "tool-middleware"}


@app.on_event("startup")
async def startup() -> None:
    logger.info("Tool middleware started on port {}", settings.tool_middleware_port)
