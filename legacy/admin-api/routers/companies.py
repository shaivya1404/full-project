"""Company CRUD router."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from admin_api.db.session import get_db
from admin_api.schemas.models import CompanyCreate, CompanyOut, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["companies"])

_TABLE = "companies"


@router.get("", response_model=List[CompanyOut])
async def list_companies(
    org_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> List[CompanyOut]:
    if org_id:
        rows = await db.execute(
            text("SELECT * FROM companies WHERE org_id = :org_id ORDER BY created_at DESC"),
            {"org_id": org_id},
        )
    else:
        rows = await db.execute(text("SELECT * FROM companies ORDER BY created_at DESC"))
    return [CompanyOut(**dict(r._mapping)) for r in rows.fetchall()]


@router.post("", response_model=CompanyOut, status_code=201)
async def create_company(
    body: CompanyCreate,
    db: AsyncSession = Depends(get_db),
) -> CompanyOut:
    row = await db.execute(
        text("""
            INSERT INTO companies
                (org_id, name, agent_name, system_prompt, product_context,
                 faq_context, language, voice_id, max_turns)
            VALUES
                (:org_id, :name, :agent_name, :system_prompt, :product_context,
                 :faq_context, :language, :voice_id, :max_turns)
            RETURNING *
        """),
        {
            "org_id": body.org_id,
            "name": body.name,
            "agent_name": body.agent_name,
            "system_prompt": body.system_prompt,
            "product_context": body.product_context,
            "faq_context": body.faq_context,
            "language": body.language.value,
            "voice_id": body.voice_id,
            "max_turns": body.max_turns,
        },
    )
    await db.commit()
    company = row.fetchone()
    logger.info("Created company id={} name={}", company.id, company.name)
    return CompanyOut(**dict(company._mapping))


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(company_id: str, db: AsyncSession = Depends(get_db)) -> CompanyOut:
    row = await db.execute(
        text("SELECT * FROM companies WHERE id = :id"), {"id": company_id}
    )
    company = row.fetchone()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyOut(**dict(company._mapping))


@router.patch("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: str,
    body: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
) -> CompanyOut:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = company_id

    row = await db.execute(
        text(f"UPDATE companies SET {set_clause}, updated_at = now() WHERE id = :id RETURNING *"),
        updates,
    )
    await db.commit()
    company = row.fetchone()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyOut(**dict(company._mapping))


@router.delete("/{company_id}", status_code=204)
async def delete_company(company_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await db.execute(text("DELETE FROM companies WHERE id = :id"), {"id": company_id})
    await db.commit()
