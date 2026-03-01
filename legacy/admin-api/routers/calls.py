"""CallSession read-only router for admin dashboard."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from admin_api.db.session import get_db
from admin_api.schemas.models import CallSessionOut

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("", response_model=List[CallSessionOut])
async def list_calls(
    company_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> List[CallSessionOut]:
    conditions = []
    params: dict = {"limit": limit}

    if company_id:
        conditions.append("company_id = :company_id")
        params["company_id"] = company_id
    if status:
        conditions.append("status = :status")
        params["status"] = status

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = await db.execute(
        text(f"SELECT * FROM call_sessions {where} ORDER BY started_at DESC LIMIT :limit"),
        params,
    )
    return [CallSessionOut(**dict(r._mapping)) for r in rows.fetchall()]


@router.get("/{call_id}", response_model=CallSessionOut)
async def get_call(call_id: str, db: AsyncSession = Depends(get_db)) -> CallSessionOut:
    row = await db.execute(
        text("SELECT * FROM call_sessions WHERE id = :id"), {"id": call_id}
    )
    call = row.fetchone()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return CallSessionOut(**dict(call._mapping))
