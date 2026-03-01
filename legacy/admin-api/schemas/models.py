"""Pydantic schemas for admin-api."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AgentLanguage(str, Enum):
    en = "en"
    hi = "hi"
    en_hi = "en_hi"


# ── Company ────────────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    org_id: str
    name: str
    agent_name: str = "Aria"
    system_prompt: str
    product_context: Optional[str] = None
    faq_context: Optional[str] = None
    language: AgentLanguage = AgentLanguage.en
    voice_id: Optional[str] = None
    max_turns: int = Field(default=30, ge=1, le=100)


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    agent_name: Optional[str] = None
    system_prompt: Optional[str] = None
    product_context: Optional[str] = None
    faq_context: Optional[str] = None
    language: Optional[AgentLanguage] = None
    voice_id: Optional[str] = None
    max_turns: Optional[int] = Field(default=None, ge=1, le=100)
    is_active: Optional[bool] = None


class CompanyOut(BaseModel):
    id: str
    org_id: str
    name: str
    agent_name: str
    system_prompt: str
    product_context: Optional[str]
    faq_context: Optional[str]
    language: AgentLanguage
    voice_id: Optional[str]
    max_turns: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── PhoneNumber ────────────────────────────────────────────────────────────────

class PhoneNumberCreate(BaseModel):
    company_id: str
    number: str = Field(description="E.164 format e.g. +919876543210")


class PhoneNumberOut(BaseModel):
    id: str
    company_id: str
    number: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── CallSession ────────────────────────────────────────────────────────────────

class CallSessionOut(BaseModel):
    id: str
    phone_number_id: str
    company_id: str
    external_call_id: Optional[str]
    caller_number: Optional[str]
    status: str
    started_at: datetime
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]
    turn_count: int
    dominant_emotion: Optional[str]
    summary: Optional[str]

    class Config:
        from_attributes = True
