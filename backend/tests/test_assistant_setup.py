"""Step C2: settings, model factory, tracing off. No network: building a client makes no request."""
import os
from dataclasses import replace

import pytest

import app.assistant  # noqa: F401  (forces tracing off)
from app.assistant.llm import UNAVAILABLE, AssistantUnavailable, build_chat_model
from app.config import Settings

FAKE_KEY = "sk-ant-test-not-a-real-key-123456"


def settings(**overrides) -> Settings:
    return replace(Settings(), **{"anthropic_api_key": "", **overrides})


def test_defaults():
    s = Settings()
    assert s.llm_provider == "anthropic"
    assert s.chat_model == "claude-haiku-5-5"
    assert (s.chat_max_message_chars, s.chat_max_tool_turns, s.chat_max_history) == (500, 4, 10)


def test_no_key_means_unavailable():
    with pytest.raises(AssistantUnavailable) as e:
        build_chat_model(settings())
    assert str(e.value) == UNAVAILABLE


def test_unknown_provider_means_unavailable():
    with pytest.raises(AssistantUnavailable):
        build_chat_model(settings(anthropic_api_key=FAKE_KEY, llm_provider="nobody"))


def test_builds_haiku_with_low_effort():
    m = build_chat_model(settings(anthropic_api_key=FAKE_KEY))
    assert m.model == "claude-haiku-5-5"
    assert m.effort == "low"
    assert m.max_retries == 1


def test_key_never_in_repr_or_errors():
    s = settings(anthropic_api_key=FAKE_KEY)
    assert FAKE_KEY not in repr(s)
    m = build_chat_model(s)
    assert FAKE_KEY not in repr(m) and FAKE_KEY not in str(m.model_dump())
    try:
        build_chat_model(replace(s, llm_provider="nobody"))
    except AssistantUnavailable as e:
        assert FAKE_KEY not in str(e)


def test_tracing_forced_off():
    from langsmith.utils import tracing_is_enabled

    for var in ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_TRACING"):
        assert os.environ[var] == "false"
    assert not tracing_is_enabled()
