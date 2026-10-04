"""Price lookup: cache -> Yahoo (live) -> stored snapshot, always labelled.

Never presents snapshot or synthetic prices as live: `source` and `note` say what was used.
"""
from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import dataclass, field
from datetime import date
from typing import Callable

import pandas as pd

from app.config import Settings
from app.core.prices import DemoProvider
from app.pricing import live
from app.pricing.cache import TTLCache
from app.pricing.snapshot import Snapshot

LIVE_NOTE = "Live prices from Yahoo Finance (daily closes, may be delayed)."
DEMO_NOTE = "SYNTHETIC demo prices (not real). For offline testing only."
CIRCUIT_OPEN_S = 60  # after a Yahoo error or timeout, skip live calls for this long

LiveFetch = Callable[[str, date, date, float], pd.Series]


@dataclass
class PriceData:
    closes: pd.DataFrame  # DatetimeIndex rows, one column per ticker
    latest: dict[str, float]
    source: str  # "live" | "snapshot" | "demo"
    note: str
    as_of: date | None
    missing: list[str] = field(default_factory=list)


def _fetch_start(start: date) -> date:
    """Round the start down to Jan 1 so different users share one cache entry per ticker."""
    return date(start.year, 1, 1)


class PriceService:
    def __init__(
        self,
        settings: Settings,
        live_fetch: LiveFetch = live.fetch_closes,
        snapshot: Snapshot | None = None,
        today: Callable[[], date] = date.today,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.settings = settings
        self._live_fetch = live_fetch
        self.snapshot = snapshot if snapshot is not None else Snapshot.load(settings.snapshot_path)
        self._today = today
        self._clock = clock
        self._cache: TTLCache[tuple[date, pd.Series]] = TTLCache(clock)
        self._bad: TTLCache[bool] = TTLCache(clock)
        self._circuit_until = 0.0
        self._circuit_lock = threading.Lock()
        self._yahoo_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="yahoo")
        self._ticker_pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix="ticker")

    # ---- public -------------------------------------------------------------
    def get(self, tickers: list[str], start: date) -> PriceData:
        mode = self.settings.price_source
        if mode == "demo":
            return self._demo(tickers, start)
        if mode == "snapshot":
            return self._from_parts(tickers, start, {}, list(tickers))

        outcomes = dict(zip(tickers, self._ticker_pool.map(lambda t: self._live(t, start), tickers)))
        got = {t: s for t, (status, s) in outcomes.items() if status == "ok"}
        fallback = [t for t, (status, _) in outcomes.items() if status != "ok"]
        return self._from_parts(tickers, start, got, fallback)

    # ---- live path ----------------------------------------------------------
    def _live(self, ticker: str, start: date) -> tuple[str, pd.Series | None]:
        if self._bad.get(ticker):
            return "bad", None
        if self._clock() < self._circuit_until:
            return "error", None
        want = _fetch_start(start)

        def fetch() -> tuple[date, pd.Series]:
            fut = self._yahoo_pool.submit(
                self._live_fetch, ticker, want, self._today(), self.settings.price_timeout_s
            )
            return want, fut.result(timeout=self.settings.price_timeout_s + 5)

        try:
            fetched_from, series = self._cache.get_or_fetch(
                ticker,
                fetch,
                ttl_s=self.settings.price_ttl_s,
                is_fresh=lambda v: v[0] <= want,
                timeout_s=self.settings.price_timeout_s + 10,
            )
            if fetched_from > want:  # shared a concurrent fetch that started later; fetch our range
                fetched_from, series = fetch()
                self._cache.set(ticker, (fetched_from, series), self.settings.price_ttl_s)
        except (FutureTimeout, Exception):  # noqa: BLE001  network, Yahoo or timeout: fall back
            with self._circuit_lock:
                self._circuit_until = self._clock() + CIRCUIT_OPEN_S
            return "error", None
        if series.empty:
            self._bad.set(ticker, True, self.settings.bad_ticker_ttl_s)
            return "bad", None
        return "ok", series[series.index >= pd.Timestamp(start)]

    # ---- assembling -----------------------------------------------------------
    def _from_parts(
        self, tickers: list[str], start: date, got: dict[str, pd.Series], fallback: list[str]
    ) -> PriceData:
        used_snapshot: list[str] = []
        missing: list[str] = []
        series = dict(got)
        for t in fallback:
            s = self.snapshot.series(t, start)
            if s is not None and not s.empty:
                series[t] = s
                used_snapshot.append(t)
            else:
                missing.append(t)

        if used_snapshot or self.settings.price_source == "snapshot":
            source = "snapshot"
            when = self.snapshot.as_of.isoformat() if self.snapshot.as_of else "an earlier date"
            partial = used_snapshot and len(used_snapshot) < len(series)
            scope = f" for {', '.join(sorted(used_snapshot))}" if partial else ""
            note = f"Prices as of {when}, live feed unavailable{scope}."
        else:
            source = "live"
            note = LIVE_NOTE
        return self._package(series, source, note, sorted(missing))

    def _demo(self, tickers: list[str], start: date) -> PriceData:
        frame = DemoProvider().history(tickers, start, self._today())
        series = {t: frame[t].dropna() for t in tickers if t in frame and not frame[t].dropna().empty}
        missing = sorted(set(tickers) - set(series))
        return self._package(series, "demo", DEMO_NOTE, missing)

    @staticmethod
    def _package(series: dict[str, pd.Series], source: str, note: str, missing: list[str]) -> PriceData:
        if series:
            closes = pd.DataFrame(series).sort_index()
        else:
            closes = pd.DataFrame()
        latest = {t: float(s.iloc[-1]) for t, s in series.items() if not s.empty}
        last_dates = [s.index.max() for s in series.values() if not s.empty]
        as_of = max(last_dates).date() if last_dates else None
        return PriceData(closes, latest, source, note, as_of, missing)

    def close(self) -> None:
        self._yahoo_pool.shutdown(wait=False, cancel_futures=True)
        self._ticker_pool.shutdown(wait=False, cancel_futures=True)
