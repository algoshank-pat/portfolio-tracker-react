"""The one place that knows which LLM provider is used.

Everything else in the assistant talks to a LangChain `BaseChatModel`, so adding GPT or Llama later
means installing that provider's LangChain package and adding a branch here (SPEC.md A3).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app.config import Settings

if TYPE_CHECKING:  # LangChain loads on the first question, not at startup
    from langchain_core.language_models import BaseChatModel

UNAVAILABLE = "The assistant is unavailable right now."


class AssistantUnavailable(RuntimeError):
    """No usable model: missing key or unknown provider. The message is safe to show users."""

    def __init__(self) -> None:
        super().__init__(UNAVAILABLE)


def build_chat_model(settings: Settings) -> "BaseChatModel":
    """Chat model from settings, or AssistantUnavailable. Never puts the key in an error message."""
    if settings.llm_provider == "anthropic":
        if not settings.anthropic_api_key:
            raise AssistantUnavailable()
        from langchain_anthropic import ChatAnthropic  # imported lazily: keeps startup light
        from pydantic import SecretStr

        return ChatAnthropic(
            model=settings.chat_model,
            api_key=SecretStr(settings.anthropic_api_key),
            max_tokens=1024,
            effort="low",  # short factual answers; the tools do the work
            timeout=settings.chat_timeout_s,
            max_retries=1,
        )
    raise AssistantUnavailable()
