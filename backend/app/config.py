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
