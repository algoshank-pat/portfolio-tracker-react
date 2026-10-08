"""Turn validated transactions and prices into the API responses defined in SPEC.md."""
from __future__ import annotations

import io
import math
import re
from datetime import date
from typing import Any

import pandas as pd

from app.config import Settings
from app.core import accounting
from app.core.history import value_history
from app.core.transactions import COLUMNS, ValidationError, normalize, parse_csv
from app.pricing.service import PriceService

_ROW_RE = re.compile(r"^Row (\d+):")


def _num(x: Any, digits: int | None = None) -> float | None:
    """JSON-safe number: NaN/inf become None."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, digits) if digits is not None else f


# ---- validation -----------------------------------------------------------------
def _check_size(tx: pd.DataFrame, settings: Settings) -> None:
    tickers = tx["ticker"].nunique()
    if tickers > settings.max_tickers:
        raise ValidationError([f"Too many tickers: {tickers} (limit {settings.max_tickers})."])


def _check_rows(n: int, settings: Settings) -> None:
    if n > settings.max_rows:
        raise ValidationError([f"Too many rows: {n} (limit {settings.max_rows:,})."])


def validate_csv(text: str, settings: Settings) -> pd.DataFrame:
    # Count data lines before parsing so a huge file is rejected cheaply.
    lines = [ln for ln in text.splitlines() if ln.strip()]
    _check_rows(max(len(lines) - 1, 0), settings)
    tx = parse_csv(io.StringIO(text))
    _check_size(tx, settings)
    return tx


def validate_rows(rows: list[dict[str, Any]], settings: Settings) -> pd.DataFrame:
    """Rows from JSON. Error row numbers are 1-based (first row = Row 1)."""
    _check_rows(len(rows), settings)
    if not rows:
        raise ValidationError(["There are no transaction rows."])
    try:
        tx = normalize(pd.DataFrame(rows))
    except ValidationError as e:
        # The core numbers rows like a spreadsheet (header = row 1); JSON rows have no header.
        raise ValidationError([_ROW_RE.sub(lambda m: f"Row {int(m.group(1)) - 1}:", msg) for msg in e.errors])
    _check_size(tx, settings)
    return tx


def to_json_rows(tx: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {
            "trade_date": r.trade_date.date().isoformat(),
            "ticker": r.ticker,
            "side": r.side,
            "quantity": float(r.quantity),
            "price": float(r.price),
            "fees": float(r.fees),
        }
        for r in tx[COLUMNS].itertuples(index=False)
    ]


# ---- portfolio and performance --------------------------------------------------
def _current(tx: pd.DataFrame, prices: PriceService) -> tuple[pd.DataFrame, Any]:
    start = tx["trade_date"].min().date()
    tickers = sorted(tx["ticker"].unique())
    data = prices.get(tickers, start)
    valued = accounting.value_holdings(accounting.holdings(tx), data.latest)
    return valued, data


def _missing(valued: pd.DataFrame, data) -> list[str]:
    """Open positions without a price (closed positions do not need one)."""
    return sorted(valued.loc[valued["current_price"].isna(), "ticker"].tolist())


def portfolio(tx: pd.DataFrame, prices: PriceService) -> dict[str, Any]:
    valued, data = _current(tx, prices)
    current_value = float(valued["market_value"].sum(skipna=True)) if len(valued) else 0.0
    holdings = [
        {
            "ticker": r.ticker,
            "quantity": _num(r.quantity),
            "avg_cost": _num(r.avg_cost),
            "current_price": _num(r.current_price),
            "market_value": _num(r.market_value),
            "unrealized_pl": _num(r.unrealized_pl),
            "unrealized_pl_pct": _num(r.unrealized_pl_pct),
            "weight": _num(r.weight),
        }
        for r in valued.itertuples(index=False)
    ]
    return {
        "as_of": data.as_of.isoformat() if data.as_of else None,
        "price_source": data.source,
        "price_note": data.note,
        "current_value": _num(current_value),
        "holdings": holdings,
        "missing_prices": _missing(valued, data),
    }


def performance(tx: pd.DataFrame, prices: PriceService) -> dict[str, Any]:
    valued, data = _current(tx, prices)
    current_value = float(valued["market_value"].sum(skipna=True)) if len(valued) else 0.0
    as_of: date = data.as_of or date.today()
    summary = accounting.summary(tx, current_value, as_of=as_of)
    hist = value_history(tx, data.closes) if not data.closes.empty else pd.DataFrame()
    trend = [
        {
            "date": d.date().isoformat(),
            "portfolio_value": _num(row["Portfolio value"], 2),
            "net_invested": _num(row["Net invested"], 2),
        }
        for d, row in hist.iterrows()
    ]
    return {
        "as_of": data.as_of.isoformat() if data.as_of else None,
        "price_source": data.source,
        "price_note": data.note,
        "summary": {k: _num(v) for k, v in summary.items()},
        "trend": trend,
        "missing_prices": _missing(valued, data),
    }


# ---- what-if (assistant tool, SPEC.md A6) ----------------------------------------
def _snapshot(tx: pd.DataFrame, prices: PriceService, ticker: str) -> tuple[dict[str, Any], Any]:
    """Totals plus one ticker's position, computed by the same engine as the dashboards."""
    valued, data = _current(tx, prices)
    current_value = float(valued["market_value"].sum(skipna=True)) if len(valued) else 0.0
    s = accounting.summary(tx, current_value, as_of=data.as_of or date.today())
    row = valued[valued["ticker"] == ticker]
    pos = row.iloc[0] if len(row) else None
    return {
        "current_value": _num(current_value),
        "total_invested": _num(s["total_invested"]),
        "total_sold": _num(s["total_sold"]),
        "total_return": _num(s["total_return"]),
        "total_return_pct": _num(s["total_return_pct"]),
        "xirr": _num(s["xirr"]),
        "ticker_quantity": _num(pos["quantity"]) if pos is not None else 0.0,
        "ticker_avg_cost": _num(pos["avg_cost"]) if pos is not None else None,
        "ticker_weight": _num(pos["weight"]) if pos is not None else 0.0,
    }, data


def what_if(
    tx: pd.DataFrame,
    prices: PriceService,
    side: str,
    ticker: str,
    quantity: float,
    price: float | None = None,
    fees: float = 0.0,
) -> dict[str, Any]:
    """One hypothetical BUY or SELL of a ticker already in the transactions, dated at the as-of date.

    Re-validated by the same code as an upload (an oversell is rejected) and recomputed by the same
    engine. Price defaults to that ticker's latest price. Nothing is saved.
    """
    ticker = str(ticker).strip().upper()
    side = str(side).strip().upper()
    if ticker not in set(tx["ticker"]):
        raise ValidationError([f"{ticker} is not in this portfolio."])
    problems = []
    if side not in ("BUY", "SELL"):
        problems.append("Side must be BUY or SELL.")
    if not quantity or quantity <= 0:
        problems.append("Quantity must be greater than 0.")
    if price is not None and price < 0:
        problems.append("Price must be 0 or more.")
    if fees < 0:
        problems.append("Fees must be 0 or more.")
    if problems:
        raise ValidationError(problems)
    before, data = _snapshot(tx, prices, ticker)
    if price is None:
        price = data.latest.get(ticker)
        if price is None:
            raise ValidationError([f"No current price for {ticker}, so a price is needed."])
    as_of = data.as_of or date.today()
    trade = {
        "trade_date": pd.Timestamp(as_of),
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": price,
        "fees": fees,
    }
    new_tx = normalize(pd.concat([tx[COLUMNS], pd.DataFrame([trade])], ignore_index=True))
    after, _ = _snapshot(new_tx, prices, ticker)
    return {
        "trade": {
            "side": side,
            "ticker": ticker,
            "quantity": _num(quantity),
            "price": _num(price),
            "fees": _num(fees),
            "date": as_of.isoformat(),
        },
        "before": before,
        "after": after,
        "as_of": as_of.isoformat(),
        "price_source": data.source,
        "price_note": data.note,
    }
