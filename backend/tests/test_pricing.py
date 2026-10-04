import threading
from datetime import date

import pandas as pd

from app.pricing.cache import TTLCache
from tests.fakes import FakeLive, service, snapshot


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def test_ttl_cache_expires():
    clock = Clock()
    c = TTLCache(clock)
    c.set("k", 1, ttl_s=10)
    assert c.get("k") == 1
    clock.t += 11
    assert c.get("k") is None


def test_single_flight_shares_one_fetch():
    c = TTLCache()
    calls = []
    gate = threading.Event()

    def fetch():
        calls.append(1)
        gate.wait(2)
        return "v"

    results = []
    threads = [threading.Thread(target=lambda: results.append(c.get_or_fetch("k", fetch, 60))) for _ in range(5)]
    for t in threads:
        t.start()
    gate.set()
    for t in threads:
        t.join()
    assert results == ["v"] * 5 and len(calls) == 1


def test_price_cache_avoids_refetch():
    live = FakeLive()
    svc = service(live)
    svc.get(["AAPL"], date(2024, 3, 1))
    svc.get(["AAPL"], date(2024, 6, 1))  # same year bucket, already covered
    assert live.calls == ["AAPL"]
    svc.get(["AAPL"], date(2023, 6, 1))  # earlier start needs a wider fetch
    assert live.calls == ["AAPL", "AAPL"]


def test_bad_ticker_is_remembered():
    live = FakeLive()
    svc = service(live)
    first = svc.get(["ZZZZ"], date(2024, 1, 1))
    second = svc.get(["ZZZZ"], date(2024, 1, 1))
    assert first.missing == ["ZZZZ"] and second.missing == ["ZZZZ"]
    assert live.calls == ["ZZZZ"]


def test_yahoo_error_opens_circuit_and_uses_snapshot():
    live = FakeLive(fail=True)
    svc = service(live, snap=snapshot({"AAPL": 190.0}))
    a = svc.get(["AAPL"], date(2024, 1, 1))
    b = svc.get(["AAPL"], date(2024, 1, 1))
    assert a.source == b.source == "snapshot"
    assert live.calls == ["AAPL"]  # second call skipped Yahoo while the circuit is open


def test_live_timeout_falls_back():
    live = FakeLive(delay=1.5)
    svc = service(live, snap=snapshot({"AAPL": 190.0}), price_timeout_s=-4)  # wait budget = timeout + 5 = 1 s
    data = svc.get(["AAPL"], date(2024, 1, 1))
    assert data.source == "snapshot"


def test_snapshot_mode_never_calls_yahoo():
    live = FakeLive()
    svc = service(live, snap=snapshot({"AAPL": 190.0}), price_source="snapshot")
    data = svc.get(["AAPL", "MSFT"], date(2024, 1, 1))
    assert live.calls == [] and data.source == "snapshot" and data.missing == ["MSFT"]


def test_series_trimmed_to_start():
    data = service(FakeLive()).get(["AAPL"], date(2025, 6, 2))
    assert data.closes.index.min() == pd.Timestamp("2025-06-02")
