from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.fakes import FakeLive, service, snapshot

SAMPLE_CSV = (Path(__file__).parent.parent / "data" / "sample_transactions.csv").read_text()


def client(prices=None, **overrides) -> TestClient:
    svc = prices or service()
    if overrides:
        svc.settings = replace(svc.settings, **overrides)
    return TestClient(create_app(svc.settings, svc))


def sample_rows(c: TestClient) -> list[dict]:
    r = c.post("/api/transactions/validate", json={"csv": SAMPLE_CSV})
    assert r.status_code == 200
    return r.json()["transactions"]


# ---- validate ---------------------------------------------------------------------
def test_validate_csv_returns_clean_rows():
    r = client().post("/api/transactions/validate", json={"csv": SAMPLE_CSV})
    body = r.json()
    assert r.status_code == 200 and body["count"] == 7
    assert body["transactions"][0] == {
        "trade_date": "2024-01-15",
        "ticker": "AAPL",
        "side": "BUY",
        "quantity": 10.0,
        "price": 185.0,
        "fees": 1.0,
    }


def test_validate_csv_errors_use_spreadsheet_rows():
    text = "trade_date,ticker,side,quantity,price\n2024-01-02,AAPL,BUY,1,10\n2024-01-03,AAPL,HOLD,1,10\n"
    r = client().post("/api/transactions/validate", json={"csv": text})
    assert r.status_code == 422
    assert r.json()["errors"][0].startswith("Row 3:")


def test_validate_rows_errors_are_one_based():
    rows = [
        {"trade_date": "2024-01-02", "ticker": "AAPL", "side": "BUY", "quantity": 1, "price": 10},
        {"trade_date": "2024-01-03", "ticker": "AAPL", "side": "HOLD", "quantity": 1, "price": 10},
    ]
    r = client().post("/api/transactions/validate", json={"rows": rows})
    assert r.status_code == 422
    assert r.json()["errors"] == ["Row 2: side must be BUY or SELL, got 'HOLD'."]


def test_validate_needs_csv_or_rows():
    assert client().post("/api/transactions/validate", json={}).status_code == 422
    r = client().post("/api/transactions/validate", json={"csv": "x", "rows": []})
    assert r.status_code == 422 and "not both" in r.json()["errors"][0]


def test_wrong_json_shape_gives_readable_errors():
    r = client().post("/api/portfolio", json={"transactions": "nope"})
    assert r.status_code == 422 and isinstance(r.json()["errors"][0], str)


# ---- limits -------------------------------------------------------------------------
def test_body_too_large_is_413():
    r = client(max_body_bytes=1000).post("/api/transactions/validate", json={"csv": "x" * 2000})
    assert r.status_code == 413 and "too large" in r.json()["errors"][0]


def test_streamed_body_without_length_is_413():
    def chunks():
        for _ in range(3):
            yield b"x" * 600

    r = client(max_body_bytes=1000).post(
        "/api/transactions/validate", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 413


def test_too_many_rows():
    r = client(max_rows=3).post("/api/transactions/validate", json={"csv": SAMPLE_CSV})
    assert r.status_code == 422 and "Too many rows" in r.json()["errors"][0]


def test_too_many_tickers():
    r = client(max_tickers=2).post("/api/transactions/validate", json={"csv": SAMPLE_CSV})
    assert r.status_code == 422 and "Too many tickers" in r.json()["errors"][0]


def test_rate_limit_returns_429_with_retry_after():
    c = client(rate_limit_per_minute=2)
    for _ in range(2):
        assert c.post("/api/transactions/validate", json={"csv": SAMPLE_CSV}).status_code == 200
    r = c.post("/api/transactions/validate", json={"csv": SAMPLE_CSV})
    assert r.status_code == 429 and "retry-after" in r.headers
    assert c.get("/health").status_code == 200  # health is not rate limited


def test_cors_allows_only_configured_origin():
    c = client()
    pre = {"Access-Control-Request-Method": "POST"}
    ok = c.options("/api/portfolio", headers={"Origin": "http://localhost:5173", **pre})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = c.options("/api/portfolio", headers={"Origin": "https://evil.example", **pre})
    assert "access-control-allow-origin" not in bad.headers


# ---- portfolio -------------------------------------------------------------------
def test_portfolio_matches_hand_calculation():
    c = client()
    r = c.post("/api/portfolio", json={"transactions": sample_rows(c)})
    body = r.json()
    assert r.status_code == 200
    assert body["price_source"] == "live" and body["missing_prices"] == []
    assert body["current_value"] == pytest.approx(12260)  # 10*200 + 3*420 + 30*300
    h = {x["ticker"]: x for x in body["holdings"]}
    assert h["AAPL"]["avg_cost"] == pytest.approx(2827 / 15)
    assert h["VTI"]["market_value"] == pytest.approx(9000)
    assert sum(x["weight"] for x in body["holdings"]) == pytest.approx(1.0)
    assert body["as_of"] == "2026-01-02"


def test_missing_price_is_null_not_nan():
    c = client(service(FakeLive({"AAPL": 200.0, "VTI": 300.0})))
    body = c.post("/api/portfolio", json={"transactions": sample_rows(c)}).json()
    assert body["missing_prices"] == ["MSFT"]
    msft = next(x for x in body["holdings"] if x["ticker"] == "MSFT")
    assert msft["current_price"] is None and msft["weight"] is None
    assert body["current_value"] == pytest.approx(11000)


def test_snapshot_fallback_is_labelled():
    svc = service(FakeLive(fail=True), snap=snapshot({"AAPL": 190.0, "MSFT": 400.0, "VTI": 280.0}))
    c = client(svc)
    body = c.post("/api/portfolio", json={"transactions": sample_rows(c)}).json()
    assert body["price_source"] == "snapshot"
    assert body["price_note"] == "Prices as of 2025-12-31, live feed unavailable."
    assert body["as_of"] == "2025-12-31"


def test_partial_snapshot_names_tickers():
    svc = service(FakeLive({"AAPL": 200.0, "MSFT": 420.0}), snap=snapshot({"VTI": 280.0}))
    c = client(svc)
    body = c.post("/api/portfolio", json={"transactions": sample_rows(c)}).json()
    assert body["price_source"] == "snapshot"
    assert body["price_note"].endswith("live feed unavailable for VTI.")


# ---- performance ---------------------------------------------------------------
def test_performance_summary_and_trend():
    c = client()
    body = c.post("/api/performance", json={"transactions": sample_rows(c)}).json()
    s = body["summary"]
    assert s["total_invested"] == pytest.approx(12528)
    assert s["total_sold"] == pytest.approx(1888)
    assert s["current_value"] == pytest.approx(12260)
    assert s["total_return"] == pytest.approx(1620)
    assert s["total_return_pct"] == pytest.approx(1620 / 12528)
    assert s["xirr"] is not None
    trend = body["trend"]
    assert trend[0]["date"] == "2024-01-15" and trend[-1]["date"] == "2026-01-02"
    assert trend[-1]["portfolio_value"] == pytest.approx(12260)
    assert trend[-1]["net_invested"] == pytest.approx(12528 - 1888)
    assert body["missing_prices"] == []


def test_performance_rejects_oversell():
    c = client()
    extra = {"trade_date": "2025-06-01", "ticker": "MSFT", "side": "SELL", "quantity": 99, "price": 1, "fees": 0}
    r = c.post("/api/performance", json={"transactions": sample_rows(c) + [extra]})
    assert r.status_code == 422 and "only 3 held" in r.json()["errors"][0]


def test_unexpected_error_is_json_and_logs_no_body(caplog):
    class Boom:
        settings = service().settings

        def get(self, *_a, **_k):
            raise RuntimeError("secret-ish detail AAPL 123")

    c = TestClient(create_app(Boom.settings, Boom()), raise_server_exceptions=False)
    rows = sample_rows(c)
    r = c.post("/api/portfolio", json={"transactions": rows})
    assert r.status_code == 500 and r.json() == {"errors": ["Something went wrong on the server."]}
    logged = " ".join(rec.getMessage() for rec in caplog.records)
    assert "RuntimeError" in logged and "secret-ish" not in logged and "185" not in logged


def test_demo_mode_is_labelled_synthetic():
    c = client(service(price_source="demo"))
    body = c.post("/api/portfolio", json={"transactions": sample_rows(c)}).json()
    assert body["price_source"] == "demo" and "SYNTHETIC" in body["price_note"]
