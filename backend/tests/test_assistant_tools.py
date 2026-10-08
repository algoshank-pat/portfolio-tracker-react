"""Step C3: the assistant's tools, offline. Fake prices: AAPL 200, MSFT 420, VTI 300 (tests/fakes.py).

Sample by hand: value 10x200 + 3x420 + 30x300 = 12,260; invested 12,528; sold 1,888;
total return 12,260 + 1,888 - 12,528 = 1,620 (12.9% of invested).
"""
import pytest
from pydantic import ValidationError as SchemaError

import app.assistant  # noqa: F401  (tracing off)
from app.assistant.tools import build_tools
from tests.fakes import FakeLive, service, snapshot


@pytest.fixture
def tools(sample_tx):
    return {t.name: t for t in build_tools(sample_tx, service())}


def test_exactly_five_tools(tools):
    assert sorted(tools) == ["get_holdings", "get_performance", "get_price_status", "get_xirr", "what_if"]


def test_get_holdings(tools):
    r = tools["get_holdings"].invoke({})
    assert r["current_value"] == "$12,260.00" and r["price_source"] == "live"
    by = {h["ticker"]: h for h in r["holdings"]}
    assert [h["ticker"] for h in r["holdings"]] == ["VTI", "AAPL", "MSFT"]  # largest first
    assert by["VTI"]["market_value"] == "$9,000.00" and by["VTI"]["weight"] == "73.4%"
    assert by["AAPL"]["quantity"] == "10" and by["AAPL"]["avg_cost"] == "$188.47"
    assert by["MSFT"]["unrealized_gain_loss"] == "+$59.40"  # 3x420 - 3x400.20


def test_get_performance(tools):
    r = tools["get_performance"].invoke({})
    assert r["total_invested"] == "$12,528.00"
    assert r["total_sold"] == "$1,888.00"
    assert r["current_value"] == "$12,260.00"
    assert r["total_return"] == "+$1,620.00"
    assert r["total_return_pct_of_invested"] == "+12.9%"
    assert r["xirr_annualized"].startswith("+")


def test_get_xirr_matches_performance(tools):
    assert tools["get_xirr"].invoke({})["xirr_annualized"] == tools["get_performance"].invoke({})["xirr_annualized"]


def test_get_price_status_live(tools):
    r = tools["get_price_status"].invoke({})
    assert r["live"] is True and r["tickers"] == ["AAPL", "MSFT", "VTI"] and r["missing_prices"] == []


def test_price_status_says_snapshot(sample_tx):
    svc = service(FakeLive(fail=True), snap=snapshot({"AAPL": 190.0, "MSFT": 400.0, "VTI": 280.0}))
    t = {x.name: x for x in build_tools(sample_tx, svc)}
    for name in ("get_holdings", "get_performance", "get_xirr", "get_price_status"):
        r = t[name].invoke({})
        assert r["price_source"] == "snapshot" and "Prices as of 2025-12-31" in r["price_note"], name
    assert t["get_price_status"].invoke({})["live"] is False


def test_what_if_buy_at_latest_price(tools):
    r = tools["what_if"].invoke({"side": "BUY", "ticker": "aapl", "quantity": 5})
    assert r["hypothetical_trade"].startswith("BUY 5 AAPL at $200.00")
    b, a = r["before"], r["after"]
    assert (b["current_value"], a["current_value"]) == ("$12,260.00", "$13,260.00")
    assert (b["total_invested"], a["total_invested"]) == ("$12,528.00", "$13,528.00")
    assert a["total_return"] == b["total_return"] == "+$1,620.00"  # bought at market, no fees
    assert (b["AAPL_quantity"], a["AAPL_quantity"]) == ("10", "15")
    assert a["AAPL_avg_cost"] == "$192.31"  # (1,884.67 + 1,000) / 15
    assert r["note"] == "Hypothetical only; nothing was saved."


def test_what_if_sell_closes_position(tools):
    r = tools["what_if"].invoke({"side": "SELL", "ticker": "MSFT", "quantity": 3})
    a = r["after"]
    assert a["MSFT_quantity"] == "0" and a["MSFT_avg_cost"] is None and a["MSFT_weight"] == "0.0%"
    assert a["total_sold"] == "$3,148.00" and a["current_value"] == "$11,000.00"


def test_what_if_custom_price_and_fees(tools):
    r = tools["what_if"].invoke({"side": "SELL", "ticker": "VTI", "quantity": 10, "price": 350, "fees": 5})
    assert "at $350.00 (fees $5.00)" in r["hypothetical_trade"]
    assert r["after"]["total_sold"] == "$5,383.00"  # 1,888 + 10x350 - 5


def test_what_if_oversell_rejected(tools):
    r = tools["what_if"].invoke({"side": "SELL", "ticker": "MSFT", "quantity": 4})
    assert "only 3 held" in r["error"]


def test_what_if_unknown_ticker_rejected(tools):
    assert tools["what_if"].invoke({"side": "BUY", "ticker": "TSLA", "quantity": 1})["error"] == "TSLA is not in this portfolio."


def test_what_if_schema_rejects_bad_args(tools):
    with pytest.raises(SchemaError):
        tools["what_if"].invoke({"side": "HOLD", "ticker": "AAPL", "quantity": 1})
    with pytest.raises(SchemaError):
        tools["what_if"].invoke({"side": "BUY", "ticker": "AAPL", "quantity": 0})


def test_what_if_saves_nothing(sample_tx, tools):
    before = sample_tx.copy()
    tools["what_if"].invoke({"side": "BUY", "ticker": "AAPL", "quantity": 5})
    assert sample_tx.equals(before)
    assert tools["get_holdings"].invoke({})["current_value"] == "$12,260.00"
