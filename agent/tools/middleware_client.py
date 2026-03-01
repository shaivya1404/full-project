"""Dispatches Qwen tool calls directly to async DB functions.

Previously made HTTP requests to tool-middleware (2 hops, ~150-250ms overhead).
Now calls agent/tools/db_tools.py directly, sharing the same DB connection pool.
Public API (execute / close) is unchanged — agent/agent.py needs no edits.
"""
from __future__ import annotations

from typing import Any

from loguru import logger

from agent.tools import db_tools

_HANDLERS = {
    "search_faq":       db_tools.search_faq,
    "lookup_customer":  db_tools.lookup_customer,
    "search_products":  db_tools.search_products,
    "get_order_status": db_tools.get_order_status,
    "create_order":     db_tools.create_order,
}


class MiddlewareClient:
    async def execute(self, tool_name: str, arguments: dict) -> Any:
        """Dispatch a tool call by name, return result dict."""
        handler = _HANDLERS.get(tool_name)
        if not handler:
            logger.warning("Unknown tool requested: {}", tool_name)
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            return await handler(**arguments)
        except Exception as exc:
            logger.error("Tool {} failed: {}", tool_name, exc)
            return {"error": str(exc)}

    async def close(self) -> None:
        # No persistent client to close — DB pool is managed by agent/db.py
        pass
