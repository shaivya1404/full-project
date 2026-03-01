"""PhoneNumber CRUD router."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from admin_api.db.session import get_db
from admin_api.schemas.models import PhoneNumberCreate, PhoneNumberOut

router = APIRouter(prefix="/phone-numbers", tags=["phone-numbers"])


@router.get("", response_model=List[PhoneNumberOut])
async def list_phone_numbers(
    company_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> List[PhoneNumberOut]:
    if company_id:
        rows = await db.execute(
            text("SELECT * FROM phone_numbers WHERE company_id = :company_id ORDER BY created_at DESC"),
            {"company_id": company_id},
        )
    else:
        rows = await db.execute(text("SELECT * FROM phone_numbers ORDER BY created_at DESC"))
    return [PhoneNumberOut(**dict(r._mapping)) for r in rows.fetchall()]


@router.post("", response_model=PhoneNumberOut, status_code=201)
async def create_phone_number(
    body: PhoneNumberCreate,
    db: AsyncSession = Depends(get_db),
) -> PhoneNumberOut:
    # Verify company exists
    row = await db.execute(
        text("SELECT id FROM companies WHERE id = :id"), {"id": body.company_id}
    )
    if not row.fetchone():
        raise HTTPException(status_code=404, detail="Company not found")

    row = await db.execute(
        text("""
            INSERT INTO phone_numbers (company_id, number)
            VALUES (:company_id, :number)
            RETURNING *
        """),
        {"company_id": body.company_id, "number": body.number},
    )
    await db.commit()
    pn = row.fetchone()
    logger.info("Registered phone number {} -> company {}", pn.number, pn.company_id)
    return PhoneNumberOut(**dict(pn._mapping))


@router.get("/{phone_number_id}", response_model=PhoneNumberOut)
async def get_phone_number(phone_number_id: str, db: AsyncSession = Depends(get_db)) -> PhoneNumberOut:
    row = await db.execute(
        text("SELECT * FROM phone_numbers WHERE id = :id"), {"id": phone_number_id}
    )
    pn = row.fetchone()
    if not pn:
        raise HTTPException(status_code=404, detail="PhoneNumber not found")
    return PhoneNumberOut(**dict(pn._mapping))


@router.delete("/{phone_number_id}", status_code=204)
async def delete_phone_number(phone_number_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await db.execute(text("DELETE FROM phone_numbers WHERE id = :id"), {"id": phone_number_id})
    await db.commit()


@router.get("/lookup/{e164_number}", response_model=PhoneNumberOut)
async def lookup_by_number(e164_number: str, db: AsyncSession = Depends(get_db)) -> PhoneNumberOut:
    """Used by the agent at call start to resolve which company owns this number."""
    row = await db.execute(
        text("SELECT * FROM phone_numbers WHERE number = :number AND is_active = true"),
        {"number": e164_number},
    )
    pn = row.fetchone()
    if not pn:
        raise HTTPException(status_code=404, detail="Phone number not registered or inactive")
    return PhoneNumberOut(**dict(pn._mapping))
