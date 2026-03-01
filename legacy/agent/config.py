"""Agent configuration — all env vars in one place."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Internal services ──────────────────────────────────────────────────────
    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    stt_service_url: str = Field(default="http://localhost:8002", alias="STT_SERVICE_URL")
    emotion_service_url: str = Field(default="http://localhost:8003", alias="EMOTION_SERVICE_URL")
    tool_middleware_url: str = Field(default="http://localhost:8005", alias="TOOL_MIDDLEWARE_URL")
    admin_api_url: str = Field(default="http://localhost:8006", alias="ADMIN_API_URL")

    # ── LLM — works for both Groq and local vLLM (same OpenAI-compatible API) ─
    # Groq   : LLM_BASE_URL=https://api.groq.com/openai/v1
    # Local  : LLM_BASE_URL=http://localhost:8000/v1
    llm_base_url: str = Field(
        default="https://api.groq.com/openai/v1",
        alias="LLM_BASE_URL",
    )
    llm_api_key: str = Field(
        default="not-needed",   # overridden by GROQ_API_KEY in Groq mode
        alias="LLM_API_KEY",
    )
    llm_model: str = Field(
        default="qwen/qwen3-32b",  # Groq model id (qwen3-32b is faster than qwq for conversation)
        alias="LLM_MODEL",
    )

    # ── Cartesia TTS ──────────────────────────────────────────────────────────
    cartesia_api_key: str = Field(alias="CARTESIA_API_KEY")
    cartesia_model_id: str = Field(default="sonic-2", alias="CARTESIA_MODEL_ID")

    # ── Agent WebSocket server ─────────────────────────────────────────────────
    agent_host: str = Field(default="0.0.0.0", alias="AGENT_HOST")
    agent_port: int = Field(default=8010, alias="AGENT_PORT")

    # ── Misc ───────────────────────────────────────────────────────────────────
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    device: str = Field(default="cpu", alias="DEVICE")
    vad_silence_ms: int = Field(default=300, alias="VAD_SILENCE_MS")
    default_max_turns: int = Field(default=30, alias="DEFAULT_MAX_TURNS")

    model_config = SettingsConfigDict(
        env_file=(".env",),
        env_file_encoding="utf-8",
        protected_namespaces=("settings_",),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
