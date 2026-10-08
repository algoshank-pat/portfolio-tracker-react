"""Settings read from environment variables (no secrets live here)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str] = field(default_factory=_origins)
    # "live" (Yahoo, falling back to the snapshot), "snapshot" (snapshot only) or "demo" (synthetic, labelled).
    price_source: str = field(default_factory=lambda: os.environ.get("PRICE_SOURCE", "live").lower())
    max_body_bytes: int = field(default_factory=lambda: _int("MAX_BODY_BYTES", 2_000_000))
    max_rows: int = field(default_factory=lambda: _int("MAX_ROWS", 5_000))
    max_tickers: int = field(default_factory=lambda: _int("MAX_TICKERS", 25))
    rate_limit_per_minute: int = field(default_factory=lambda: _int("RATE_LIMIT_PER_MINUTE", 60))
    price_timeout_s: int = field(default_factory=lambda: _int("PRICE_TIMEOUT_S", 15))
    price_ttl_s: int = field(default_factory=lambda: _int("PRICE_TTL_S", 900))
    bad_ticker_ttl_s: int = field(default_factory=lambda: _int("BAD_TICKER_TTL_S", 300))
    snapshot_path: Path = field(default_factory=lambda: DATA_DIR / "price_snapshot.json")

    # "Ask your portfolio" assistant (SPEC.md section 11). The key is a secret: repr=False keeps it
    # out of any printed or logged Settings object.
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""), repr=False)
    llm_provider: str = field(default_factory=lambda: os.environ.get("LLM_PROVIDER", "anthropic").lower())
    chat_model: str = field(default_factory=lambda: os.environ.get("CHAT_MODEL", "claude-haiku-5-5"))
    chat_max_message_chars: int = field(default_factory=lambda: _int("CHAT_MAX_MESSAGE_CHARS", 500))
    chat_max_tool_turns: int = field(default_factory=lambda: _int("CHAT_MAX_TOOL_TURNS", 4))
    chat_max_history: int = field(default_factory=lambda: _int("CHAT_MAX_HISTORY", 10))
    chat_timeout_s: int = field(default_factory=lambda: _int("CHAT_TIMEOUT_S", 30))
    # List prices for the cost estimate in the metrics log line (USD per million tokens; Haiku 5.5 defaults).
    chat_price_in_per_mtok: float = field(default_factory=lambda: _float("CHAT_PRICE_IN_PER_MTOK", 0.10))
    chat_price_out_per_mtok: float = field(default_factory=lambda: _float("CHAT_PRICE_OUT_PER_MTOK", 0.50))
