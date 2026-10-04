"""XIRR: annualized return of dated cash flows (365-day year, like Excel)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Sequence


def _to_date(d) -> date:
    if isinstance(d, datetime):
        return d.date()
    if hasattr(d, "to_pydatetime"):
        return d.to_pydatetime().date()
    return d


def xirr(cashflows: Sequence[tuple[object, float]]) -> float | None:
    """Return the annualized rate, or None if it cannot be computed.

    Outflows (investments) are negative, inflows positive. Needs at least one
    of each. Solved by bisection so it never diverges.
    """
    flows = [(_to_date(d), float(a)) for d, a in cashflows if a != 0]
    if len(flows) < 2:
        return None
    if not (any(a > 0 for _, a in flows) and any(a < 0 for _, a in flows)):
        return None
    t0 = min(d for d, _ in flows)
    years = [((d - t0).days) / 365.0 for d, _ in flows]
    amounts = [a for _, a in flows]

    def npv(rate: float) -> float:
        return sum(a / (1.0 + rate) ** y for a, y in zip(amounts, years))

    try:
        lo, hi = -0.9999, 1.0
        f_lo, f_hi = npv(lo), npv(hi)
        while f_lo * f_hi > 0 and hi < 1e6:
            hi *= 2
            f_hi = npv(hi)
        if f_lo * f_hi > 0:
            return None
        for _ in range(300):
            mid = (lo + hi) / 2
            f_mid = npv(mid)
            if abs(f_mid) < 1e-9 or (hi - lo) < 1e-12:
                return mid
            if f_lo * f_mid < 0:
                hi, f_hi = mid, f_mid
            else:
                lo, f_lo = mid, f_mid
        return (lo + hi) / 2
    except (OverflowError, ZeroDivisionError):
        return None
