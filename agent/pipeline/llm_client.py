"""LLM client — works for both Groq and local vLLM, no code change needed.

Both speak the OpenAI-compatible API. Switch by changing 3 env vars:

  # Groq (now)
  LLM_BASE_URL=https://api.groq.com/openai/v1
  LLM_API_KEY=gsk_xxxx
  LLM_MODEL=qwen-qwq-32b

  # Local vLLM (later)
  LLM_BASE_URL=http://localhost:8000/v1
  LLM_API_KEY=not-needed
  LLM_MODEL=Qwen/Qwen2.5-32B-Instruct
"""
from __future__ import annotations

import json
from typing import AsyncGenerator, List

from loguru import logger
from openai import AsyncOpenAI

from agent.config import settings


class LLMClient:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
        self._model = settings.llm_model
        logger.info("LLM client -> {} | model={}", settings.llm_base_url, self._model)

    async def chat_stream(
        self,
        messages: List[dict],
        tools: List[dict] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Stream chat completions from Groq or local vLLM.

        Yields:
          {"type": "text_delta", "delta": str}
          {"type": "tool_call",  "name": str, "arguments": dict}
          {"type": "done"}
        """
        kwargs: dict = {
            "model": self._model,
            "messages": messages,
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 512,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        accumulated_args: dict[int, str] = {}
        accumulated_name: dict[int, str] = {}

        try:
            stream = await self._client.chat.completions.create(**kwargs)
            async for chunk in stream:
                if not chunk.choices:
                    continue

                choice = chunk.choices[0]
                delta = choice.delta

                if delta.content:
                    yield {"type": "text_delta", "delta": delta.content}

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if tc.function.name:
                            accumulated_name[idx] = tc.function.name
                        if tc.function.arguments:
                            accumulated_args[idx] = accumulated_args.get(idx, "") + tc.function.arguments

                if choice.finish_reason == "tool_calls":
                    for idx, name in accumulated_name.items():
                        raw_args = accumulated_args.get(idx, "{}")
                        try:
                            args = json.loads(raw_args)
                        except Exception:
                            args = {}
                        yield {"type": "tool_call", "name": name, "arguments": args}
                    accumulated_name.clear()
                    accumulated_args.clear()

        except Exception as exc:
            logger.error("LLM stream error ({}): {}", settings.llm_base_url, exc)
            yield {
                "type": "text_delta",
                "delta": "I'm sorry, I'm having trouble right now. Please try again.",
            }

        yield {"type": "done"}

    async def close(self) -> None:
        await self._client.close()
