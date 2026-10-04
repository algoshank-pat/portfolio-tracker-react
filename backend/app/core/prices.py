"""Price providers. Real prices: yfinance (unofficial Yahoo Finance, may be delayed).

Prices are UNADJUSTED closes so they compare with the prices in your transactions.
"""
from __future__ import annotations

import zlib
from datetime import date, timedelta
from typing import Protocol, Sequence

import numpy as np
import pandas as pd


class PriceProvider(Protocol):
    name: str

    def history(self, tickers: Sequence[str], start: date, end: date) -> pd.DataFrame: ...

    def latest(self, tickers: Sequence[str]) -> dict[str, float]: ...


def _close_frame(data: pd.DataFrame, tickers: Sequence[str]) -> pd.DataFrame:
    """Pull the Close columns out of whatever shape yfinance returned."""
    if data is None or data.empty:
        return pd.DataFrame(columns=list(tickers))
    if isinstance(data.columns, pd.MultiIndex):
        close = data["Close"]
    else:
        close = data[["Close"]].copy()
        close.columns = [tickers[0]]
    if isinstance(close, pd.Series):
        close = close.to_frame(tickers[0])
    close = close.copy()
    idx = pd.to_datetime(close.index)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    close.index = idx.normalize()
    close.columns = [str(c).upper() for c in close.columns]
    return close.dropna(how="all")


class YFinanceProvider:
    name = "Yahoo Finance (yfinance)"

    def history(self, tickers: Sequence[str], start: date, end: date) -> pd.DataFrame:
        import yfinance as yf  # imported lazily so tests do not need the network

        tickers = list(tickers)
        data = yf.download(
            tickers,
            start=start.isoformat(),
            end=(end + timedelta(days=1)).isoformat(),
            auto_adjust=False,
            progress=False,
            group_by="column",
            threads=True,
        )
        return _close_frame(data, tickers)

    def latest(self, tickers: Sequence[str]) -> dict[str, float]:
        today = date.today()
        h = self.history(tickers, today - timedelta(days=10), today).ffill()
        if h.empty:
            return {}
        last = h.iloc[-1].dropna()
        return {str(t): float(p) for t, p in last.items()}


class DemoProvider:
    """Deterministic SYNTHETIC prices for offline demos and tests. Not real data."""

    name = "SYNTHETIC demo prices (not real)"

    def _series(self, ticker: str, start: date, end: date) -> pd.Series:
        seed = zlib.crc32(ticker.encode())
        origin = pd.bdate_range("2018-01-01", date.today() + timedelta(days=5))
        steps = np.random.default_rng(seed).normal(0.0004, 0.012, len(origin))
        base = 50 + (seed % 250)
        s = pd.Series(base * np.cumprod(1 + steps), index=origin)
        return s[(s.index >= pd.Timestamp(start)) & (s.index <= pd.Timestamp(end))]

    def history(self, tickers: Sequence[str], start: date, end: date) -> pd.DataFrame:
        return pd.DataFrame({t: self._series(t, start, end) for t in tickers})

    def latest(self, tickers: Sequence[str]) -> dict[str, float]:
        today = date.today()
        h = self.history(tickers, today - timedelta(days=10), today).ffill()
        return {t: float(h[t].dropna().iloc[-1]) for t in tickers if not h[t].dropna().empty}


def get_provider(source: str | None) -> PriceProvider:
    return DemoProvider() if (source or "").lower() == "demo" else YFinanceProvider()
