"""Stored price snapshot used when the live feed is unavailable.

File format (written by scripts/snapshot_prices.py):
    {"as_of": "YYYY-MM-DD", "generated_at": "<ISO time>", "source": "...",
     "closes": {"AAPL": {"2024-01-02": 185.64, ...}, ...}}
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd


class Snapshot:
    def __init__(self, as_of: date | None, closes: dict[str, pd.Series]):
        self.as_of = as_of
        self._closes = closes

    @classmethod
    def load(cls, path: Path) -> "Snapshot":
        if not path.exists():
            return cls(None, {})
        raw = json.loads(path.read_text(encoding="utf-8"))
        closes = {}
        for ticker, points in raw.get("closes", {}).items():
            s = pd.Series(points, dtype=float)
            s.index = pd.to_datetime(s.index)
            closes[ticker.upper()] = s.sort_index()
        as_of = date.fromisoformat(raw["as_of"]) if raw.get("as_of") else None
        return cls(as_of, closes)

    def has(self, ticker: str) -> bool:
        return ticker in self._closes

    def series(self, ticker: str, start: date) -> pd.Series | None:
        s = self._closes.get(ticker)
        if s is None:
            return None
        return s[s.index >= pd.Timestamp(start)]
