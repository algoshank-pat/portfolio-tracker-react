"""Per-ticker daily closes from Yahoo Finance (yfinance), unadjusted.

`yf.download` shares global state between calls, so concurrent requests use
`yf.Ticker(...).history` instead, one ticker per call.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

import pandas as pd

from app.core.prices import _close_frame

# yfinance logs failed symbols; those come from user requests, which we never log.
logging.getLogger("yfinance").setLevel(logging.CRITICAL)


def fetch_closes(ticker: str, start: date, end: date, timeout_s: float) -> pd.Series:
    """Daily unadjusted closes for one ticker. Empty series means Yahoo has no data for it."""
    import yfinance as yf  # imported lazily so tests never touch the network

    data = yf.Ticker(ticker).history(
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        interval="1d",
        auto_adjust=False,
        actions=False,
        timeout=timeout_s,
    )
    frame = _close_frame(data, [ticker])
    if frame.empty or ticker not in frame.columns:
        return pd.Series(dtype=float)
    return frame[ticker].dropna()
