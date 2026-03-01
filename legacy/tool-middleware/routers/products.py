"""Product search tool.

Qwen calls: search_products(query, company_id) to answer questions like:
  "What products do you sell?"
  "How much does X cost?"
  "Is Y in stock?"
  "Tell me about product Z"
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tool_middleware.db.session import get_db

router = APIRouter(prefix="/tools/products", tags=["tools"])


class ProductSearchRequest(BaseModel):
    query: str
    company_id: str
    category: Optional[str] = None
    in_stock_only: bool = False
    top_k: int = 5


class ProductResult(BaseModel):
    id: str
    name: str
    sku: Optional[str]
    description: Optional[str]
    price: Optional[float]
    currency: str
    category: Optional[str]
    in_stock: bool


class ProductSearchResponse(BaseModel):
    results: List[ProductResult]
    total_found: int


@router.post("/search", response_model=ProductSearchResponse)
async def search_products(
    req: ProductSearchRequest,
    db: AsyncSession = Depends(get_db),
) -> ProductSearchResponse:
    conditions = ["company_id = :company_id"]
    params: dict = {"company_id": req.company_id, "limit": req.top_k}

    if req.in_stock_only:
        conditions.append("in_stock = true")
    if req.category:
        conditions.append("category ILIKE :category")
        params["category"] = f"%{req.category}%"

    # Keyword search across name, description, sku, category
    if req.query:
        conditions.append(
            "(name ILIKE :q OR description ILIKE :q OR sku ILIKE :q OR category ILIKE :q)"
        )
        params["q"] = f"%{req.query}%"

    where = " AND ".join(conditions)
    rows = await db.execute(
        text(f"""
            SELECT id, name, sku, description, price, currency, category, in_stock
            FROM products
            WHERE {where}
            ORDER BY in_stock DESC, name ASC
            LIMIT :limit
        """),
        params,
    )
    products = rows.fetchall()

    return ProductSearchResponse(
        results=[
            ProductResult(
                id=str(p.id),
                name=p.name,
                sku=p.sku,
                description=p.description,
                price=p.price,
                currency=p.currency,
                category=p.category,
                in_stock=p.in_stock,
            )
            for p in products
        ],
        total_found=len(products),
    )
