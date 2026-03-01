"""Qwen tool JSON schemas — the 5 tools the LLM can call.

  1. search_faq        — search company FAQ text
  2. lookup_customer   — who is this caller? any past orders?
  3. search_products   — what do we sell? price? in stock?
  4. get_order_status  — track an existing order
  5. create_order      — place a new order on behalf of caller
"""
from __future__ import annotations

from typing import List

TOOLS: List[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_faq",
            "description": (
                "Search the company FAQ knowledge base. "
                "Use when the customer asks a general question about policies, "
                "hours, returns, shipping, or anything that might be in the FAQ."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The customer's question or keywords to search for.",
                    },
                    "company_id": {
                        "type": "string",
                        "description": "Company ID — injected automatically, do not ask the user.",
                    },
                },
                "required": ["query", "company_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_customer",
            "description": (
                "Look up the caller's customer profile by phone number. "
                "Call this at the START of every conversation to personalize responses. "
                "Returns name, past orders count, and notes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "phone": {
                        "type": "string",
                        "description": "Caller phone number in E.164 format — injected automatically.",
                    },
                    "company_id": {
                        "type": "string",
                        "description": "Company ID — injected automatically.",
                    },
                },
                "required": ["phone", "company_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": (
                "Search the company's product catalog. "
                "Use when the customer asks: what products do you have, "
                "how much does X cost, is Y available, tell me about product Z."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Product name, category, or keyword to search for.",
                    },
                    "company_id": {
                        "type": "string",
                        "description": "Company ID — injected automatically.",
                    },
                    "in_stock_only": {
                        "type": "boolean",
                        "description": "If true, only return products currently in stock.",
                        "default": False,
                    },
                },
                "required": ["query", "company_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_status",
            "description": (
                "Get the current status and details of an existing order. "
                "Use when the customer provides an order number and wants to know "
                "where their order is or what's in it."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "order_number": {
                        "type": "string",
                        "description": "The order number provided by the customer (e.g. ORD-AB12CD34).",
                    },
                    "company_id": {
                        "type": "string",
                        "description": "Company ID — injected automatically.",
                    },
                },
                "required": ["order_number", "company_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": (
                "Place a new order on behalf of the customer. "
                "Use when the customer says they want to buy something, "
                "place an order, or book a product/service. "
                "Always confirm items and quantities with the customer before calling this."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "company_id": {
                        "type": "string",
                        "description": "Company ID — injected automatically.",
                    },
                    "customer_phone": {
                        "type": "string",
                        "description": "Caller phone number — injected automatically.",
                    },
                    "items": {
                        "type": "array",
                        "description": "List of items to order.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_name": {
                                    "type": "string",
                                    "description": "Name of the product.",
                                },
                                "quantity": {
                                    "type": "integer",
                                    "description": "How many units.",
                                    "default": 1,
                                },
                            },
                            "required": ["product_name"],
                        },
                    },
                    "notes": {
                        "type": "string",
                        "description": "Any special instructions from the customer.",
                    },
                },
                "required": ["company_id", "customer_phone", "items"],
            },
        },
    },
]
