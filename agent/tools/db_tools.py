"""Direct async DB implementations of the 5 agent tools.

Replaces the HTTP hop to tool-middleware (~150-250ms saved per tool call).
SQL is identical to tool-middleware/routers/ — no logic changes.
"""
from __future__ import annotations

import random
import string
from typing import Any, Optional

from loguru import logger
from sqlalchemy import text

from agent.db import SessionLocal


async def search_faq(query: str, company_id: str, top_k: int = 3) -> dict:
    """Keyword search over companies.faq_context, returns scored snippets."""
    async with SessionLocal() as db:
        row = await db.execute(
            text("SELECT faq_context FROM companies WHERE id = :id AND is_active = true"),
            {"id": company_id},
        )
        company = row.fetchone()

    if not company or not company.faq_context:
        return {"results": []}

    faq_text: str = company.faq_context
    query_lower = query.lower()
    paragraphs = [p.strip() for p in faq_text.split("\n\n") if p.strip()]
    query_words = set(query_lower.split())

    scored: list[tuple[float, str]] = []
    for para in paragraphs:
        overlap = sum(1 for w in query_words if w in para.lower())
        if overlap > 0:
            scored.append((overlap / len(query_words), para))

    scored.sort(key=lambda x: x[0], reverse=True)
    return {
        "results": [
            {"snippet": text_, "relevance": score}
            for score, text_ in scored[:top_k]
        ]
    }


async def lookup_customer(phone: str, company_id: str) -> dict:
    """Look up a customer by phone. Returns order count too."""
    async with SessionLocal() as db:
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
            {"phone": phone, "company_id": company_id},
        )
        customer = row.fetchone()

    if not customer:
        return {"found": False}

    return {
        "found": True,
        "customer_id": str(customer.id),
        "name": customer.name,
        "email": customer.email,
        "notes": customer.notes,
        "total_orders": int(customer.total_orders),
    }


async def search_products(
    query: str,
    company_id: str,
    in_stock_only: bool = False,
    category: Optional[str] = None,
    top_k: int = 5,
) -> dict:
    """ILIKE keyword search across name, description, sku, category."""
    conditions = ["company_id = :company_id"]
    params: dict[str, Any] = {"company_id": company_id, "limit": top_k}

    if in_stock_only:
        conditions.append("in_stock = true")
    if category:
        conditions.append("category ILIKE :category")
        params["category"] = f"%{category}%"
    if query:
        conditions.append(
            "(name ILIKE :q OR description ILIKE :q OR sku ILIKE :q OR category ILIKE :q)"
        )
        params["q"] = f"%{query}%"

    where = " AND ".join(conditions)
    async with SessionLocal() as db:
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

    results = [
        {
            "id": str(p.id),
            "name": p.name,
            "sku": p.sku,
            "description": p.description,
            "price": p.price,
            "currency": p.currency,
            "category": p.category,
            "in_stock": p.in_stock,
        }
        for p in products
    ]
    return {"results": results, "total_found": len(results)}


async def get_order_status(order_number: str, company_id: str) -> dict:
    """Fetch order + order_items by order number."""
    async with SessionLocal() as db:
        row = await db.execute(
            text("""
                SELECT
                    o.id, o.order_number, o.status,
                    o.total_amount, o.currency,
                    o.estimated_delivery, o.notes
                FROM orders o
                WHERE o.order_number = :order_number
                  AND o.company_id = :company_id
                LIMIT 1
            """),
            {"order_number": order_number, "company_id": company_id},
        )
        order = row.fetchone()

        if not order:
            return {"found": False}

        items_rows = await db.execute(
            text("""
                SELECT name, quantity, unit_price
                FROM order_items
                WHERE order_id = :order_id
            """),
            {"order_id": str(order.id)},
        )
        items = [
            {"name": i.name, "quantity": i.quantity, "unit_price": i.unit_price}
            for i in items_rows.fetchall()
        ]

    return {
        "found": True,
        "order_id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "items": items,
        "total_amount": order.total_amount,
        "currency": order.currency,
        "estimated_delivery": str(order.estimated_delivery) if order.estimated_delivery else None,
        "notes": order.notes,
    }


async def create_order(
    company_id: str,
    customer_phone: str,
    items: list[dict],
    notes: Optional[str] = None,
) -> dict:
    """Find or create customer, insert order + items. Returns order summary."""
    async with SessionLocal() as db:
        # 1. Find or create customer
        cust_row = await db.execute(
            text("""
                SELECT id FROM customers
                WHERE phone = :phone AND company_id = :company_id
                LIMIT 1
            """),
            {"phone": customer_phone, "company_id": company_id},
        )
        customer = cust_row.fetchone()

        if not customer:
            cust_insert = await db.execute(
                text("""
                    INSERT INTO customers (company_id, phone)
                    VALUES (:company_id, :phone)
                    RETURNING id
                """),
                {"company_id": company_id, "phone": customer_phone},
            )
            customer_id = str(cust_insert.fetchone().id)
            logger.info("Created new customer phone={}", customer_phone)
        else:
            customer_id = str(customer.id)

        # 2. Generate unique order number
        order_number = "ORD-" + "".join(
            random.choices(string.ascii_uppercase + string.digits, k=8)
        )

        # 3. Resolve product prices and calculate total
        total = 0.0
        resolved_items = []
        for item in items:
            unit_price = None
            product_id = item.get("product_id")
            product_name = item.get("product_name", "")
            quantity = item.get("quantity", 1)

            if not product_id:
                prod_row = await db.execute(
                    text("""
                        SELECT id, price FROM products
                        WHERE company_id = :company_id
                          AND name ILIKE :name
                          AND in_stock = true
                        LIMIT 1
                    """),
                    {"company_id": company_id, "name": f"%{product_name}%"},
                )
                prod = prod_row.fetchone()
                if prod:
                    product_id = str(prod.id)
                    unit_price = prod.price

            if unit_price:
                total += unit_price * quantity

            resolved_items.append({
                "product_id": product_id,
                "name": product_name,
                "quantity": quantity,
                "unit_price": unit_price,
            })

        # 4. Insert order
        order_insert = await db.execute(
            text("""
                INSERT INTO orders
                    (company_id, customer_id, order_number, status,
                     total_amount, currency, notes)
                VALUES
                    (:company_id, :customer_id, :order_number, 'confirmed',
                     :total_amount, 'INR', :notes)
                RETURNING id
            """),
            {
                "company_id": company_id,
                "customer_id": customer_id,
                "order_number": order_number,
                "total_amount": total if total > 0 else None,
                "notes": notes,
            },
        )
        order_id = str(order_insert.fetchone().id)

        # 5. Insert order items
        for it in resolved_items:
            await db.execute(
                text("""
                    INSERT INTO order_items
                        (order_id, product_id, name, quantity, unit_price)
                    VALUES
                        (:order_id, :product_id, :name, :quantity, :unit_price)
                """),
                {
                    "order_id": order_id,
                    "product_id": it["product_id"],
                    "name": it["name"],
                    "quantity": it["quantity"],
                    "unit_price": it["unit_price"],
                },
            )

        await db.commit()

    logger.info("Order {} created for customer {}", order_number, customer_phone)
    total_str = f" Total: INR {total:.2f}." if total > 0 else ""
    return {
        "success": True,
        "order_number": order_number,
        "order_id": order_id,
        "message": f"Order {order_number} confirmed.{total_str} We'll send updates to your registered contact.",
    }
