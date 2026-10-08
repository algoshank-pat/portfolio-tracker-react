"""The assistant's tools (SPEC.md A5/A6). All math happens here, in the existing tested code.

Tools are built per request around the browser's transactions (the server keeps nothing). Results are
compact JSON with numbers pre-formatted as display strings, so the model copies values instead of
calculating them. Every result carries `price_source` and `price_note` so stored prices are never
presented as live.
"""
from __future__ import annotations

from typing import Any, Callable, Literal

import pandas as pd
from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field

from app.core.transactions import ValidationError
from app.pricing.service import PriceService
from app.services import portfolio as svc


# ---- display formatting (no arithmetic left for the model) -------------------------
def money(v: float | None) -> str | None:
    return None if v is None else f"${v:,.2f}"


def signed_money(v: float | None) -> str | None:
    if v is None:
        return None
    return f"+${v:,.2f}" if v > 0 else (f"-${-v:,.2f}" if v < 0 else "$0.00")


def pct(v: float | None) -> str | None:
    return None if v is None else f"{v * 100:.1f}%"


def signed_pct(v: float | None) -> str | None:
    if v is None:
        return None
    return f"+{v * 100:.1f}%" if v > 0 else f"{v * 100:.1f}%"


def qty(v: float | None) -> str | None:
    return None if v is None else f"{v:,.4f}".rstrip("0").rstrip(".")


def _prices(d: dict[str, Any]) -> dict[str, Any]:
    return {"as_of": d.get("as_of"), "price_source": d.get("price_source"), "price_note": d.get("price_note")}


# ---- argument schemas ----------------------------------------------------------------
class NoArgs(BaseModel):
    """This tool takes no arguments."""


class WhatIfArgs(BaseModel):
    side: Literal["BUY", "SELL"] = Field(description="BUY or SELL")
    ticker: str = Field(description="A ticker that already appears in this portfolio's transactions")
    quantity: float = Field(gt=0, description="Number of shares, greater than 0")
    price: float | None = Field(default=None, ge=0, description="Price per share; omit to use the latest price")
    fees: float = Field(default=0.0, ge=0, description="Trade fees; default 0")


# ---- tools ---------------------------------------------------------------------------------
def build_tools(tx: pd.DataFrame, prices: PriceService) -> list[BaseTool]:
    """The five tools for one question, bound to these transactions. Results are memoised per question."""
    memo: dict[str, dict[str, Any]] = {}

    def portfolio() -> dict[str, Any]:
        if "p" not in memo:
            memo["p"] = svc.portfolio(tx, prices)
        return memo["p"]

    def performance() -> dict[str, Any]:
        if "f" not in memo:
            memo["f"] = svc.performance(tx, prices)
        return memo["f"]

    def get_holdings() -> dict[str, Any]:
        p = portfolio()
        # Totals as the dashboard's "Unrealized gain/loss" card computes them: holdings with a price only.
        priced = [h for h in p["holdings"] if h["current_price"] is not None]
        cost = sum(h["avg_cost"] * h["quantity"] for h in priced)
        unrealized = sum(h["unrealized_pl"] for h in priced)
        return {
            **_prices(p),
            "current_value": money(p["current_value"]),
            "number_of_holdings": len(p["holdings"]),
            "total_cost_basis": money(cost),
            "total_unrealized_gain_loss": signed_money(unrealized),
            "total_unrealized_gain_loss_pct": signed_pct(unrealized / cost) if cost > 0 else None,
            "holdings": [
                {
                    "ticker": h["ticker"],
                    "quantity": qty(h["quantity"]),
                    "avg_cost": money(h["avg_cost"]),
                    "current_price": money(h["current_price"]),
                    "market_value": money(h["market_value"]),
                    "unrealized_gain_loss": signed_money(h["unrealized_pl"]),
                    "unrealized_gain_loss_pct": signed_pct(h["unrealized_pl_pct"]),
                    "weight": pct(h["weight"]),
                }
                for h in sorted(p["holdings"], key=lambda h: -(h["market_value"] or 0))
            ],
            "missing_prices": p["missing_prices"],
        }

    def get_performance() -> dict[str, Any]:
        f = performance()
        s = f["summary"]
        trend = f["trend"]
        return {
            **_prices(f),
            "total_invested": money(s["total_invested"]),
            "total_sold": money(s["total_sold"]),
            "current_value": money(s["current_value"]),
            "total_return": signed_money(s["total_return"]),
            "total_return_pct_of_invested": signed_pct(s["total_return_pct"]),
            "xirr_annualized": signed_pct(s["xirr"]),
            "first_trade_day_in_trend": trend[0]["date"] if trend else None,
            "missing_prices": f["missing_prices"],
        }

    def get_xirr() -> dict[str, Any]:
        f = performance()
        x = f["summary"]["xirr"]
        return {
            **_prices(f),
            "xirr_annualized": signed_pct(x),
            "explanation": "Annualized return on dated cash flows (buys out, sells in, today's value as the "
            "final inflow), 365-day year." if x is not None else "XIRR can't be computed for these cash flows.",
        }

    def get_price_status() -> dict[str, Any]:
        p = portfolio()
        return {
            **_prices(p),
            "live": p["price_source"] == "live",
            "tickers": sorted(set(tx["ticker"])),
            "missing_prices": p["missing_prices"],
        }

    def what_if(side: str, ticker: str, quantity: float, price: float | None = None, fees: float = 0.0) -> dict[str, Any]:
        try:
            r = svc.what_if(tx, prices, side, ticker, quantity, price, fees)
        except ValidationError as e:
            return {"error": " ".join(e.errors)}

        def view(b: dict[str, Any]) -> dict[str, Any]:
            return {
                "current_value": money(b["current_value"]),
                "total_invested": money(b["total_invested"]),
                "total_sold": money(b["total_sold"]),
                "total_return": signed_money(b["total_return"]),
                "total_return_pct_of_invested": signed_pct(b["total_return_pct"]),
                "xirr_annualized": signed_pct(b["xirr"]),
                f"{r['trade']['ticker']}_quantity": qty(b["ticker_quantity"]),
                f"{r['trade']['ticker']}_avg_cost": money(b["ticker_avg_cost"]),
                f"{r['trade']['ticker']}_weight": pct(b["ticker_weight"]),
            }

        t, c = r["trade"], r["change"]
        return {
            **_prices(r),
            "hypothetical_trade": f"{t['side']} {qty(t['quantity'])} {t['ticker']} at {money(t['price'])} "
            f"(fees {money(t['fees'])}) on {t['date']}",
            ("trade_cost" if t["side"] == "BUY" else "trade_proceeds"): money(t["cash"]),
            "change": {
                "current_value": signed_money(c["current_value"]),
                "total_invested": signed_money(c["total_invested"]),
                "total_sold": signed_money(c["total_sold"]),
                "total_return": signed_money(c["total_return"]),
                f"{t['ticker']}_quantity": (f"+{qty(c['ticker_quantity'])}" if c["ticker_quantity"] > 0 else qty(c["ticker_quantity"])),
            },
            "before": view(r["before"]),
            "after": view(r["after"]),
            "note": "Hypothetical only; nothing was saved.",
        }

    def make(fn: Callable[..., dict[str, Any]], description: str, schema: type[BaseModel]) -> BaseTool:
        return StructuredTool.from_function(func=fn, name=fn.__name__, description=description, args_schema=schema)

    return [
        make(get_holdings, "Current holdings: quantity, average cost, current price, market value, unrealized "
             "gain/loss and weight per ticker, plus totals: current value, cost basis and total unrealized "
             "gain/loss ($ and %).", NoArgs),
        make(get_performance, "Lifetime totals: total invested, total sold, current value, total return ($ and % of "
             "invested) and XIRR.", NoArgs),
        make(get_xirr, "The portfolio's XIRR (annualized, timing-weighted return) with a one-line explanation.", NoArgs),
        make(get_price_status, "Whether prices are live or a stored snapshot, their as-of date, the tickers in the "
             "portfolio and any tickers with no price.", NoArgs),
        make(what_if, "Recompute the portfolio after ONE hypothetical BUY or SELL of a ticker already in the "
             "portfolio (default price: its latest price). Returns before and after totals and that ticker's "
             "quantity, average cost and weight. Rejects selling more than is held.", WhatIfArgs),
    ]
