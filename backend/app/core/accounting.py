"""Holdings, totals and returns from a clean transactions frame.

Method: weighted-average cost. Fees on a BUY are added to cost; fees on a SELL
reduce proceeds. Splits, dividends and currencies are not handled (v1).
"""
from __future__ import annotations

from datetime import date

import pandas as pd

from .xirr import xirr

EPS = 1e-9


def totals(tx: pd.DataFrame) -> tuple[float, float]:
    """(total_invested, total_sold) per the spec definitions."""
    buys = tx[tx["side"] == "BUY"]
    sells = tx[tx["side"] == "SELL"]
    invested = float((buys["quantity"] * buys["price"] + buys["fees"]).sum())
    sold = float((sells["quantity"] * sells["price"] - sells["fees"]).sum())
    return invested, sold


def holdings(tx: pd.DataFrame) -> pd.DataFrame:
    """Open positions: ticker, quantity, avg_cost, cost_basis (sorted by ticker)."""
    shares: dict[str, float] = {}
    cost: dict[str, float] = {}
    ordered = tx.assign(_o=tx["side"].map({"BUY": 0, "SELL": 1})).sort_values(
        ["trade_date", "_o"], kind="stable"
    )
    for r in ordered.itertuples(index=False):
        s = shares.get(r.ticker, 0.0)
        c = cost.get(r.ticker, 0.0)
        if r.side == "BUY":
            shares[r.ticker] = s + r.quantity
            cost[r.ticker] = c + r.quantity * r.price + r.fees
        else:
            avg = c / s if s > EPS else 0.0
            shares[r.ticker] = s - r.quantity
            cost[r.ticker] = c - avg * r.quantity
    rows = [
        {
            "ticker": t,
            "quantity": q,
            "avg_cost": cost[t] / q,
            "cost_basis": cost[t],
        }
        for t, q in sorted(shares.items())
        if q > EPS
    ]
    return pd.DataFrame(rows, columns=["ticker", "quantity", "avg_cost", "cost_basis"])


def value_holdings(h: pd.DataFrame, prices: dict[str, float]) -> pd.DataFrame:
    """Add current_price, market_value, unrealized P/L ($, %) and weight."""
    out = h.copy()
    out["current_price"] = out["ticker"].map(prices).astype(float)
    out["market_value"] = out["quantity"] * out["current_price"]
    out["unrealized_pl"] = out["market_value"] - out["cost_basis"]
    out["unrealized_pl_pct"] = out["unrealized_pl"] / out["cost_basis"].where(out["cost_basis"] > 0)
    total = out["market_value"].sum(skipna=True)
    out["weight"] = out["market_value"] / total if total > 0 else float("nan")
    return out


def cashflows(tx: pd.DataFrame, current_value: float, as_of: date) -> list[tuple[date, float]]:
    """BUY negative, SELL positive, plus today's current value as a final inflow."""
    flows: list[tuple[date, float]] = []
    for r in tx.itertuples(index=False):
        d = r.trade_date.date()
        if r.side == "BUY":
            flows.append((d, -(r.quantity * r.price + r.fees)))
        else:
            flows.append((d, r.quantity * r.price - r.fees))
    if current_value:
        flows.append((as_of, float(current_value)))
    return flows


def summary(tx: pd.DataFrame, current_value: float, as_of: date | None = None) -> dict:
    """Headline numbers for the Historical Performance tab."""
    as_of = as_of or date.today()
    invested, sold = totals(tx)
    total_return = current_value + sold - invested
    return {
        "total_invested": invested,
        "total_sold": sold,
        "current_value": float(current_value),
        "total_return": total_return,
        "total_return_pct": total_return / invested if invested > 0 else None,
        "xirr": xirr(cashflows(tx, current_value, as_of)),
    }
