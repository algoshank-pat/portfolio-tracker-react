"""Offline price fakes for API tests (no network)."""
from __future__ import annotations

import threading
import time
from datetime import date

import pandas as pd

from app.config import Settings
from app.pricing.service import PriceService
from app.pricing.snapshot import Snapshot

TODAY = date(2026, 1, 2)
FLAT = {"AAPL": 200.0, "MSFT": 420.0, "VTI": 300.0}


class FakeLive:
    """Flat prices on business days; unknown tickers return empty; can be told to fail or stall."""

    def __init__(self, prices=None, fail=False, delay=0.0):
        self.prices = dict(FLAT if prices is None else prices)
        self.fail = fail
        self.delay = delay
        self.calls: list[str] = []
        self._lock = threading.Lock()

    def __call__(self, ticker: str, start: date, end: date, timeout_s: float) -> pd.Series:
        with self._lock:
            self.calls.append(ticker)
        if self.delay:
            time.sleep(self.delay)
        if self.fail:
            raise ConnectionError("Yahoo unreachable")
        if ticker not in self.prices:
            return pd.Series(dtype=float)
        idx = pd.bdate_range(start, end)
        return pd.Series(self.prices[ticker], index=idx, dtype=float)


def snapshot(prices: dict[str, float], as_of: date = date(2025, 12, 31)) -> Snapshot:
    idx = pd.bdate_range("2024-01-01", as_of)
    return Snapshot(as_of, {t: pd.Series(p, index=idx, dtype=float) for t, p in prices.items()})


def service(live=None, snap=None, **overrides) -> PriceService:
    settings = Settings(**{"price_source": "live", "cors_origins": ["http://localhost:5173"], **overrides})
    return PriceService(
        settings,
        live_fetch=live or FakeLive(),
        snapshot=snap if snap is not None else Snapshot(None, {}),
        today=lambda: TODAY,
    )
