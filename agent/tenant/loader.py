"""Tenant loader — resolves a Twilio 'to' number to a Company config at call start."""
from __future__ import annotations

from typing import Optional

import httpx
from loguru import logger

from agent.config import settings
from agent.memory.schemas import CompanyConfig


class TenantLoader:
    """Loads Company config from admin-api by phone number lookup."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=5.0)

    async def load_by_number(self, e164_number: str) -> Optional[CompanyConfig]:
        """Resolve a phone number to its CompanyConfig.

        Returns None if the number is not registered (call should be rejected).
        """
        try:
            # Step 1: lookup phone number → company_id
            resp = await self._client.get(
                f"{settings.admin_api_url}/admin/v1/phone-numbers/lookup/{e164_number}"
            )
            if resp.status_code == 404:
                logger.warning("Unregistered number: {}", e164_number)
                return None
            resp.raise_for_status()
            pn = resp.json()

            # Step 2: load company config
            company_resp = await self._client.get(
                f"{settings.admin_api_url}/admin/v1/companies/{pn['company_id']}"
            )
            company_resp.raise_for_status()
            c = company_resp.json()

            return CompanyConfig(
                id=c["id"],
                org_id=c["org_id"],
                name=c["name"],
                agent_name=c["agent_name"],
                system_prompt=c["system_prompt"],
                product_context=c.get("product_context"),
                faq_context=c.get("faq_context"),
                language=c["language"],
                voice_id=c.get("voice_id"),
                max_turns=c["max_turns"],
            )

        except Exception as exc:
            logger.error("TenantLoader error for {}: {}", e164_number, exc)
            return None

    async def close(self) -> None:
        await self._client.aclose()
