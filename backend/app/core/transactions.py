"""Parse, validate and normalize buy/sell transactions."""
from __future__ import annotations

import re
from typing import IO

import pandas as pd

COLUMNS = ["trade_date", "ticker", "side", "quantity", "price", "fees"]
REQUIRED = ["trade_date", "ticker", "side", "quantity", "price"]
TICKER_RE = re.compile(r"^[A-Z0-9][A-Z0-9.\-]{0,9}$")
MAX_ERRORS_SHOWN = 20
EPS = 1e-9


class ValidationError(ValueError):
    """Raised when transactions are invalid. `errors` holds readable messages."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def empty_transactions() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "trade_date": pd.Series(dtype="datetime64[ns]"),
            "ticker": pd.Series(dtype="object"),
            "side": pd.Series(dtype="object"),
            "quantity": pd.Series(dtype="float64"),
            "price": pd.Series(dtype="float64"),
            "fees": pd.Series(dtype="float64"),
        }
    )


def _cap(errors: list[str]) -> list[str]:
    if len(errors) <= MAX_ERRORS_SHOWN:
        return errors
    extra = len(errors) - MAX_ERRORS_SHOWN
    return errors[:MAX_ERRORS_SHOWN] + [f"...and {extra} more problem(s)."]


def normalize(raw: pd.DataFrame) -> pd.DataFrame:
    """Validate a raw table and return a clean, sorted transactions frame.

    Raises ValidationError listing every problem found (never half-imports).
    Row numbers in messages count the header as row 1, like a spreadsheet.
    """
    df = raw.copy().reset_index(drop=True)
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValidationError([f"Missing required column(s): {', '.join(missing)}."])
    if "fees" not in df.columns:
        df["fees"] = 0.0
    df = df[COLUMNS]
    if df.empty:
        raise ValidationError(["There are no transaction rows."])

    errors: list[str] = []
    row = lambda i: i + 2  # noqa: E731  (spreadsheet-style row number)

    if pd.api.types.is_datetime64_any_dtype(df["trade_date"]):
        dates = df["trade_date"]
    else:
        dates = pd.to_datetime(df["trade_date"], errors="coerce", format="mixed")
    for i in df.index[dates.isna()]:
        errors.append(f"Row {row(i)}: invalid trade_date {df.at[i, 'trade_date']!r} (use YYYY-MM-DD).")

    tickers = df["ticker"].fillna("").astype(str).str.strip().str.upper()
    for i in df.index[~tickers.map(lambda t: bool(TICKER_RE.match(t)))]:
        errors.append(f"Row {row(i)}: invalid ticker {df.at[i, 'ticker']!r}.")

    sides = df["side"].fillna("").astype(str).str.strip().str.upper()
    for i in df.index[~sides.isin(["BUY", "SELL"])]:
        errors.append(f"Row {row(i)}: side must be BUY or SELL, got {df.at[i, 'side']!r}.")

    qty = pd.to_numeric(df["quantity"], errors="coerce")
    for i in df.index[~(qty > 0) | ~qty.map(pd.notna)]:
        errors.append(f"Row {row(i)}: quantity must be a number greater than 0, got {df.at[i, 'quantity']!r}.")

    price = pd.to_numeric(df["price"], errors="coerce")
    for i in df.index[~(price >= 0) | ~price.map(pd.notna)]:
        errors.append(f"Row {row(i)}: price must be a number of 0 or more, got {df.at[i, 'price']!r}.")

    fees_raw = df["fees"]
    fees = pd.to_numeric(fees_raw, errors="coerce")
    blank = fees_raw.isna() | (fees_raw.astype(str).str.strip() == "")
    fees = fees.where(~blank, 0.0)
    for i in df.index[fees.isna() | (fees < 0)]:
        errors.append(f"Row {row(i)}: fees must be a number of 0 or more, got {df.at[i, 'fees']!r}.")

    if errors:
        raise ValidationError(_cap(errors))

    clean = pd.DataFrame(
        {
            "trade_date": pd.to_datetime(dates).dt.normalize(),
            "ticker": tickers,
            "side": sides,
            "quantity": qty.astype(float),
            "price": price.astype(float),
            "fees": fees.astype(float),
        }
    )
    clean = _sort(clean)
    oversold = find_oversells(clean)
    if oversold:
        raise ValidationError(_cap(oversold))
    return clean


def _sort(df: pd.DataFrame) -> pd.DataFrame:
    """Chronological order; on the same day BUYs come before SELLs."""
    order = df["side"].map({"BUY": 0, "SELL": 1})
    out = df.assign(_o=order).sort_values(["trade_date", "_o"], kind="stable").drop(columns="_o")
    return out.reset_index(drop=True)


def find_oversells(df: pd.DataFrame) -> list[str]:
    """Messages for every SELL that exceeds the shares held at that point."""
    held: dict[str, float] = {}
    problems: list[str] = []
    for r in df.itertuples(index=False):
        cur = held.get(r.ticker, 0.0)
        if r.side == "BUY":
            held[r.ticker] = cur + r.quantity
        else:
            if r.quantity > cur + EPS:
                problems.append(
                    f"{r.trade_date.date()} {r.ticker}: selling {r.quantity:g} but only {cur:g} held."
                )
            held[r.ticker] = max(cur - r.quantity, 0.0)
    return problems


def parse_csv(file: IO | str | bytes) -> pd.DataFrame:
    """Read a CSV (path, file object or uploaded file) into clean transactions."""
    try:
        raw = pd.read_csv(file, dtype=str, skipinitialspace=True)
    except pd.errors.EmptyDataError as exc:
        raise ValidationError(["The file is empty."]) from exc
    except (pd.errors.ParserError, UnicodeDecodeError) as exc:
        raise ValidationError([f"Could not read the file as CSV: {exc}"]) from exc
    return normalize(raw)


def add_transaction(
    existing: pd.DataFrame,
    trade_date,
    ticker: str,
    side: str,
    quantity: float,
    price: float,
    fees: float = 0.0,
) -> pd.DataFrame:
    """Return `existing` plus one new row, fully re-validated."""
    new = pd.DataFrame(
        [
            {
                "trade_date": trade_date,
                "ticker": ticker,
                "side": side,
                "quantity": quantity,
                "price": price,
                "fees": fees,
            }
        ]
    )
    base = existing if len(existing) else None
    combined = new if base is None else pd.concat([base, new], ignore_index=True)
    return normalize(combined)


def combine(existing: pd.DataFrame, incoming: pd.DataFrame) -> pd.DataFrame:
    """Append `incoming` to `existing` and re-validate (e.g. oversell check)."""
    if existing.empty:
        return normalize(incoming)
    return normalize(pd.concat([existing, incoming], ignore_index=True))
