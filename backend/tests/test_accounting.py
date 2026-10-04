from datetime import date

import pytest

from app.core import accounting


def test_totals_match_hand_calculation(sample_tx):
    invested, sold = accounting.totals(sample_tx)
    # buys: AAPL 1851 + 976, MSFT 2001, VTI 5000 + 2700 ; sells: AAPL 1049, MSFT 839
    assert invested == pytest.approx(12528.0)
    assert sold == pytest.approx(1888.0)


def test_holdings_weighted_average_cost(sample_tx):
    h = accounting.holdings(sample_tx).set_index("ticker")
    assert h.loc["AAPL", "quantity"] == pytest.approx(10)
    assert h.loc["AAPL", "avg_cost"] == pytest.approx(2827 / 15)  # selling keeps avg cost
    assert h.loc["MSFT", "quantity"] == pytest.approx(3)
    assert h.loc["MSFT", "avg_cost"] == pytest.approx(2001 / 5)
    assert h.loc["VTI", "quantity"] == pytest.approx(30)
    assert h.loc["VTI", "avg_cost"] == pytest.approx(7700 / 30)


def test_fully_sold_position_disappears():
    import pandas as pd

    from app.core.transactions import normalize

    tx = normalize(
        pd.DataFrame(
            {
                "trade_date": ["2024-01-02", "2024-02-01"],
                "ticker": ["XYZ", "XYZ"],
                "side": ["BUY", "SELL"],
                "quantity": [4, 4],
                "price": [10, 12],
            }
        )
    )
    assert accounting.holdings(tx).empty


def test_valuation_and_summary(sample_tx):
    h = accounting.holdings(sample_tx)
    v = accounting.value_holdings(h, {"AAPL": 200.0, "MSFT": 420.0, "VTI": 300.0}).set_index("ticker")
    assert v.loc["AAPL", "market_value"] == pytest.approx(2000)
    assert v.loc["VTI", "market_value"] == pytest.approx(9000)
    assert v["market_value"].sum() == pytest.approx(12260)
    assert v["weight"].sum() == pytest.approx(1.0)
    assert v.loc["AAPL", "unrealized_pl"] == pytest.approx(2000 - 2827 * 10 / 15)

    s = accounting.summary(sample_tx, 12260.0, as_of=date(2026, 1, 1))
    assert s["total_return"] == pytest.approx(12260 + 1888 - 12528)
    assert s["total_return_pct"] == pytest.approx(1620 / 12528)
    assert s["xirr"] is not None and s["xirr"] > 0


def test_missing_price_gives_nan_not_crash(sample_tx):
    h = accounting.holdings(sample_tx)
    v = accounting.value_holdings(h, {"AAPL": 200.0})
    assert v["market_value"].isna().sum() == 2
