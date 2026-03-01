"""Orders tool — get status AND create new orders.

Qwen calls:
  get_order_status(order_number, company_id)
  create_order(company_id, customer_phone, items, notes)
"""
from __future__ import annotations

import random
import string
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tool_middleware.db.session import get_db

router = APIRouter(prefix="/tools/orders", tags=["tools"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class OrderStatusRequest(BaseModel):
    order_number: str
    company_id: str


class OrderItem(BaseModel):
    product_name: str
    quantity: int = 1
    product_id: Optional[str] = None


class CreateOrderRequest(BaseModel):
    company_id: str
    customer_phone: str
    items: List[OrderItem]
    notes: Optional[str] = None


class OrderItemOut(BaseModel):
    name: str
    quantity: int
    unit_price: Optional[float]


class OrderOut(BaseModel):
    found: bool
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    status: Optional[str] = None
    items: Optional[List[OrderItemOut]] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    estimated_delivery: Optional[str] = None
    notes: Optional[str] = None


class CreateOrderResponse(BaseModel):
    success: bool
    order_number: Optional[str] = None
    order_id: Optional[str] = None
    message: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/status", response_model=OrderOut)
async def get_order_status(
    req: OrderStatusRequest,
    db: AsyncSession = Depends(get_db),
) -> OrderOut:
    """Get full order details by order number."""
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
        {"order_number": req.order_number, "company_id": req.company_id},
    )
    order = row.fetchone()
    if not order:
        return OrderOut(found=False)

    # Fetch items
    items_rows = await db.execute(
        text("""
            SELECT name, quantity, unit_price
            FROM order_items
            WHERE order_id = :order_id
        """),
        {"order_id": str(order.id)},
    )
    items = [
        OrderItemOut(name=i.name, quantity=i.quantity, unit_price=i.unit_price)
        for i in items_rows.fetchall()
    ]

    return OrderOut(
        found=True,
        order_id=str(order.id),
        order_number=order.order_number,
        status=order.status,
        items=items,
        total_amount=order.total_amount,
        currency=order.currency,
        estimated_delivery=str(order.estimated_delivery) if order.estimated_delivery else None,
        notes=order.notes,
    )


@router.post("/create", response_model=CreateOrderResponse)
async def create_order(
    req: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
) -> CreateOrderResponse:
    """Create a new order for a customer (by phone number).

    If customer doesn't exist yet, creates a new customer record first.
    """
    # 1. Find or create customer
    cust_row = await db.execute(
        text("""
            SELECT id FROM customers
            WHERE phone = :phone AND company_id = :company_id
            LIMIT 1
        """),
        {"phone": req.customer_phone, "company_id": req.company_id},
    )
    customer = cust_row.fetchone()

    if not customer:
        cust_insert = await db.execute(
            text("""
                INSERT INTO customers (company_id, phone)
                VALUES (:company_id, :phone)
                RETURNING id
            """),
            {"company_id": req.company_id, "phone": req.customer_phone},
        )
        customer_id = str(cust_insert.fetchone().id)
        logger.info("Created new customer phone={}", req.customer_phone)
    else:
        customer_id = str(customer.id)

    # 2. Generate unique order number
    order_number = "ORD-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    # 3. Resolve product prices and calculate total
    total = 0.0
    resolved_items = []
    for item in req.items:
        unit_price = None
        product_id = item.product_id

        if not product_id:
            # Try to find product by name
            prod_row = await db.execute(
                text("""
                    SELECT id, price FROM products
                    WHERE company_id = :company_id
                      AND name ILIKE :name
                      AND in_stock = true
                    LIMIT 1
                """),
                {"company_id": req.company_id, "name": f"%{item.product_name}%"},
            )
            prod = prod_row.fetchone()
            if prod:
                product_id = str(prod.id)
                unit_price = prod.price

        if unit_price:
            total += unit_price * item.quantity

        resolved_items.append({
            "product_id": product_id,
            "name": item.product_name,
            "quantity": item.quantity,
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
            "company_id": req.company_id,
            "customer_id": customer_id,
            "order_number": order_number,
            "total_amount": total if total > 0 else None,
            "notes": req.notes,
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
    logger.info("Order {} created for customer {}", order_number, req.customer_phone)

    total_str = f" Total: INR {total:.2f}." if total > 0 else ""
    return CreateOrderResponse(
        success=True,
        order_number=order_number,
        order_id=order_id,
        message=f"Order {order_number} confirmed.{total_str} We'll send updates to your registered contact.",
    )
