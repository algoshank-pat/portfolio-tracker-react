"""Portfolio value over time from transactions and daily closing prices."""
from __future__ import annotations

import pandas as pd


def _daily_cumulative(delta: pd.Series, index: pd.DatetimeIndex) -> pd.Series:
    """Cumulative sum of dated deltas, carried forward onto `index` (0 before the first)."""
    cum = delta.groupby(level=0).sum().sort_index().cumsum()
    both = cum.reindex(cum.index.union(index)).ffill()
    return both.reindex(index).fillna(0.0)


def value_history(tx: pd.DataFrame, closes: pd.DataFrame) -> pd.DataFrame:
    """Daily 'Portfolio value' and 'Net invested' (buys minus sell proceeds).

    `closes`: DatetimeIndex rows, one column per ticker (unadjusted close).
    Days before the first transaction are dropped.
    """
    if tx.empty or closes.empty:
        return pd.DataFrame(columns=["Portfolio value", "Net invested"])
    closes = closes.sort_index().ffill()
    idx = closes.index
    value = pd.Series(0.0, index=idx)
    for ticker, group in tx.groupby("ticker"):
        if ticker not in closes.columns:
            continue
        signed = group["quantity"].where(group["side"] == "BUY", -group["quantity"])
        shares = _daily_cumulative(pd.Series(signed.to_numpy(), index=group["trade_date"]), idx)
        value = value + (shares * closes[ticker]).fillna(0.0)
    cash = tx["quantity"] * tx["price"]
    cash = cash.where(tx["side"] == "SELL", cash + tx["fees"])  # BUY cost incl. fees
    cash = cash.where(tx["side"] == "BUY", cash - tx["fees"])  # SELL proceeds net of fees
    signed_cash = cash.where(tx["side"] == "BUY", -cash)
    net = _daily_cumulative(pd.Series(signed_cash.to_numpy(), index=tx["trade_date"]), idx)
    out = pd.DataFrame({"Portfolio value": value, "Net invested": net}, index=idx)
    out.index.name = "date"
    return out[out.index >= tx["trade_date"].min()]
