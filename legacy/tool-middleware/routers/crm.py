"""CRM tool — customer lookup by phone number.

Qwen calls: lookup_customer(phone, company_id)
Used at call start to personalize the conversation.
Also supports upsert so new callers get a record created.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tool_middleware.db.session import get_db

router = APIRouter(prefix="/tools/crm", tags=["tools"])


class CrmLookupRequest(BaseModel):
    phone: str
    company_id: str


class CustomerInfo(BaseModel):
    found: bool
    customer_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    total_orders: Optional[int] = None


@router.post("/lookup", response_model=CustomerInfo)
async def lookup_customer(
    req: CrmLookupRequest,
    db: AsyncSession = Depends(get_db),
) -> CustomerInfo:
    """Look up a customer by phone. Returns order count too."""
    row = await db.execute(
        text("""
            SELECT
                c.id,
                c.name,
                c.email,
                c.notes,
                COUNT(o.id) AS total_orders
            FROM customers c
            LEFT JOIN orders o ON o.customer_id = c.id
            WHERE c.phone = :phone AND c.company_id = :company_id
            GROUP BY c.id, c.name, c.email, c.notes
            LIMIT 1
        """),
        {"phone": req.phone, "company_id": req.company_id},
    )
    customer = row.fetchone()

    if not customer:
        return CustomerInfo(found=False)

    return CustomerInfo(
        found=True,
        customer_id=str(customer.id),
        name=customer.name,
        email=customer.email,
        notes=customer.notes,
        total_orders=int(customer.total_orders),
    )
