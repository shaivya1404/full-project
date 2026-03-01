"""Agent WebSocket server — entry point.

API that the AI calling product developer integrates against:

  POST /calls
    Body: {"to_number": "+91...", "from_number": "+91...", "call_id": "twilio-sid"}
    Returns: {"ws_url": "ws://host:8010/calls/{call_id}/audio", "call_id": "..."}

  WS /calls/{call_id}/audio
    Binary frames IN:  16kHz PCM int16 mono audio from the caller
    Binary frames OUT: 16kHz PCM int16 mono audio to play to the caller
    JSON frames OUT:   {"type": "agent_text", "text": "..."} (when no voice_id set)
                       {"type": "transcript", "text": "...", "emotion": "..."}
                       {"type": "call_ended"}

  POST /calls/{call_id}/end
    Gracefully ends the call

  GET /health
    Returns {"status": "ok"}
"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import Dict

import uvicorn
import websockets
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel

from agent.agent import VoiceAgent
from agent.config import settings
from agent.memory.redis_store import RedisStore
from agent.tenant.loader import TenantLoader

# ── FastAPI for REST endpoints ─────────────────────────────────────────────────
http_app = FastAPI(title="Voice Agent API", version="1.0.0")

# Global shared state
redis = RedisStore()
tenant_loader = TenantLoader()

# Active agents: call_id -> VoiceAgent
active_agents: Dict[str, VoiceAgent] = {}


class StartCallRequest(BaseModel):
    to_number: str       # E.164 Twilio 'To' field
    from_number: str     # E.164 caller's number
    call_id: str | None = None  # Optional: pass Twilio CallSid


@http_app.on_event("startup")
async def startup() -> None:
    await redis.connect()
    logger.info("Agent service started — REST on :{}", settings.agent_port)


@http_app.on_event("shutdown")
async def shutdown() -> None:
    await redis.disconnect()
    await tenant_loader.close()


@http_app.get("/health")
async def health() -> dict:
    return {"status": "ok", "active_calls": len(active_agents)}


@http_app.post("/calls")
async def start_call(req: StartCallRequest) -> JSONResponse:
    """
    Called by the AI calling product when a new Twilio call arrives.
    Returns a WebSocket URL for streaming audio.
    """
    call_id = req.call_id or str(uuid.uuid4())

    # Resolve tenant
    company = await tenant_loader.load_by_number(req.to_number)
    if company is None:
        logger.warning("Rejected call to unregistered number: {}", req.to_number)
        raise HTTPException(
            status_code=404,
            detail=f"Phone number {req.to_number} is not registered to any company."
        )

    # Store pending call info; VoiceAgent is created when WS connects
    active_agents[call_id] = None  # placeholder
    await redis.set_meta(call_id, {
        "to_number": req.to_number,
        "from_number": req.from_number,
        "company_id": company.id,
        "status": "pending",
    })

    ws_url = f"ws://{settings.agent_host}:{settings.agent_port}/calls/{call_id}/audio"
    logger.info("Call {} registered -> ws_url={}", call_id, ws_url)

    return JSONResponse({
        "call_id": call_id,
        "ws_url": ws_url,
        "company_name": company.name,
        "agent_name": company.agent_name,
    })


@http_app.post("/calls/{call_id}/end")
async def end_call(call_id: str) -> dict:
    agent = active_agents.get(call_id)
    if agent:
        await agent.end()
        del active_agents[call_id]
    return {"status": "ended", "call_id": call_id}


# ── WebSocket handler (runs as separate websockets server on same port) ────────

async def ws_handler(websocket, path: str) -> None:
    """Handle incoming WebSocket connection from the calling product."""
    # path: /calls/{call_id}/audio
    parts = path.strip("/").split("/")
    if len(parts) != 3 or parts[0] != "calls" or parts[2] != "audio":
        await websocket.close(1003, "Invalid path")
        return

    call_id = parts[1]
    meta = await redis.get_meta(call_id)
    if not meta:
        await websocket.close(1003, "Unknown call_id")
        return

    company = await tenant_loader.load_by_number(meta["to_number"])
    if not company:
        await websocket.close(1003, "Company not found")
        return

    agent = VoiceAgent(
        call_id=call_id,
        company=company,
        caller_number=meta.get("from_number", "unknown"),
        to_number=meta["to_number"],
        ws=websocket,
        redis=redis,
    )
    active_agents[call_id] = agent

    await agent.start()

    # Run processing loop concurrently with audio reader
    process_task = asyncio.create_task(agent.process_utterances())

    try:
        async for message in websocket:
            if isinstance(message, bytes):
                await agent.handle_audio(message)
            else:
                # JSON control messages from calling product
                try:
                    ctrl = json.loads(message)
                    if ctrl.get("type") == "end":
                        break
                except Exception:
                    pass
    except websockets.exceptions.ConnectionClosed:
        logger.info("WebSocket closed for call {}", call_id)
    finally:
        await agent.end()
        process_task.cancel()
        active_agents.pop(call_id, None)
        # Notify calling product
        try:
            await websocket.send(json.dumps({"type": "call_ended", "call_id": call_id}))
        except Exception:
            pass


def main() -> None:
    """Run both FastAPI (HTTP) and WebSocket server on the same port using uvicorn + websockets."""
    import threading

    async def run_ws_server() -> None:
        async with websockets.serve(ws_handler, settings.agent_host, settings.agent_port):
            logger.info("WebSocket server on {}:{}", settings.agent_host, settings.agent_port)
            await asyncio.Future()  # run forever

    # Start WebSocket server in a thread
    def ws_thread() -> None:
        asyncio.run(run_ws_server())

    t = threading.Thread(target=ws_thread, daemon=True)
    t.start()

    # HTTP REST on port agent_port + 1 (e.g. 8011)
    uvicorn.run(
        "agent.main:http_app",
        host=settings.agent_host,
        port=settings.agent_port + 1,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
