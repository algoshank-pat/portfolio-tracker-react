"""Offline LLM fakes for assistant tests (no key, no network). Provider-neutral: they are LangChain models."""
from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.runnables import RunnableLambda


class FakeChat(BaseChatModel):
    """Replays scripted replies.

    `structured`: what each `with_structured_output(...).invoke` returns, in order (a dict, a model
    instance, or an Exception to raise). `replies`: AIMessages returned by plain `invoke`, in order.
    Every call's messages are recorded in `seen` for assertions.
    """

    structured: list[Any] = []
    replies: list[AIMessage] = []
    seen: list[list[BaseMessage]] = []
    structured_kwargs: list[dict[str, Any]] = []
    bound: list[dict[str, Any]] = []

    @property
    def _llm_type(self) -> str:
        return "fake-chat"

    def _generate(self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any) -> ChatResult:
        self.seen.append(list(messages))
        if not self.replies:
            raise AssertionError("FakeChat ran out of scripted replies")
        return ChatResult(generations=[ChatGeneration(message=self.replies.pop(0))])

    def with_structured_output(self, schema: Any, **kwargs: Any):  # type: ignore[override]
        self.structured_kwargs.append(kwargs)

        def run(messages: list[BaseMessage]) -> Any:
            self.seen.append(list(messages))
            nxt = self.structured.pop(0)
            if isinstance(nxt, Exception):
                raise nxt
            return nxt

        return RunnableLambda(run)

    def bind_tools(self, tools: Any, **kwargs: Any):  # type: ignore[override]
        self.bound.append(kwargs)
        return self


def fake(structured: list[Any] | None = None, replies: list[AIMessage] | None = None) -> FakeChat:
    return FakeChat(structured=list(structured or []), replies=list(replies or []), seen=[], structured_kwargs=[], bound=[])
