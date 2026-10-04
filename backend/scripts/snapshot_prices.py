"""Write data/price_snapshot.json: daily unadjusted closes for the sample tickers.

Run locally (needs internet access to Yahoo Finance):
    uv run python scripts/snapshot_prices.py            # sample tickers
    uv run python scripts/snapshot_prices.py NVDA GOOG  # sample tickers plus extras

The backend uses this file only when the live feed fails, and labels it
"Prices as of <date>, live feed unavailable".
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.transactions import parse_csv  # noqa: E402
from app.pricing.live import fetch_closes  # noqa: E402

SAMPLE = ROOT / "data" / "sample_transactions.csv"
OUT = ROOT / "data" / "price_snapshot.json"


def main(extra: list[str]) -> int:
    tx = parse_csv(SAMPLE)
    tickers = sorted(set(tx["ticker"]) | {t.strip().upper() for t in extra if t.strip()})
    first = tx["trade_date"].min().date()
    start = date(first.year, 1, 1)
    today = date.today()

    closes: dict[str, dict[str, float]] = {}
    failed: list[str] = []
    for t in tickers:
        try:
            s = fetch_closes(t, start, today, timeout_s=20)
        except Exception as exc:  # noqa: BLE001
            print(f"  {t}: failed ({type(exc).__name__}: {exc})")
            failed.append(t)
            continue
        if s.empty:
            print(f"  {t}: no data from Yahoo")
            failed.append(t)
            continue
        closes[t] = {d.date().isoformat(): round(float(p), 4) for d, p in s.items()}
        print(f"  {t}: {len(s)} days, last {s.index.max().date()} close {float(s.iloc[-1]):.2f}")

    if not closes:
        print("No prices fetched; snapshot not written.")
        return 1
    as_of = max(max(points) for points in closes.values())
    OUT.write_text(
        json.dumps(
            {
                "as_of": as_of,
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "source": "Yahoo Finance via yfinance, unadjusted daily closes",
                "closes": closes,
            },
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT.relative_to(ROOT)} (as of {as_of}, {len(closes)} tickers).")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
