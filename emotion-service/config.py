"""Configuration for emotion-service."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    device: str = Field(default="cpu", alias="DEVICE")
    model_cache_dir: str = Field(default="/models/emotion", alias="MODEL_CACHE_DIR")
    emotion_port: int = Field(default=8003, alias="EMOTION_PORT")

    model_config = SettingsConfigDict(
        env_file=(".env",),
        env_file_encoding="utf-8",
        protected_namespaces=("settings_",),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
