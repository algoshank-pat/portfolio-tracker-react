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
