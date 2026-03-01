"""FAQ search tool.

Qwen calls: search_faq(query: str, company_id: str) -> list of matching FAQ entries.
We do a simple case-insensitive keyword search over the company's faq_context text.
For production, swap with pgvector similarity search.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tool_middleware.db.session import get_db

router = APIRouter(prefix="/tools/faq", tags=["tools"])


class FaqSearchRequest(BaseModel):
    query: str
    company_id: str
    top_k: int = 3


class FaqEntry(BaseModel):
    snippet: str
    relevance: float


class FaqSearchResponse(BaseModel):
    results: List[FaqEntry]


@router.post("/search", response_model=FaqSearchResponse)
async def search_faq(req: FaqSearchRequest, db: AsyncSession = Depends(get_db)) -> FaqSearchResponse:
    row = await db.execute(
        text("SELECT faq_context FROM companies WHERE id = :id AND is_active = true"),
        {"id": req.company_id},
    )
    company = row.fetchone()
    if not company or not company.faq_context:
        return FaqSearchResponse(results=[])

    faq_text: str = company.faq_context
    query_lower = req.query.lower()

    # Split into paragraphs, score by keyword overlap
    paragraphs = [p.strip() for p in faq_text.split("\n\n") if p.strip()]
    query_words = set(query_lower.split())

    scored: List[tuple[float, str]] = []
    for para in paragraphs:
        para_lower = para.lower()
        overlap = sum(1 for w in query_words if w in para_lower)
        if overlap > 0:
            scored.append((overlap / len(query_words), para))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = [
        FaqEntry(snippet=text_, relevance=score)
        for score, text_ in scored[: req.top_k]
    ]
    return FaqSearchResponse(results=results)
