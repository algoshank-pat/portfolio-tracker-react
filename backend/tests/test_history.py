import pandas as pd
import pytest

from app.core.history import value_history
from app.core.transactions import normalize


def make_tx(rows):
    return normalize(pd.DataFrame(rows, columns=["trade_date", "ticker", "side", "quantity", "price", "fees"]))


def closes():
    idx = pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"])
    return pd.DataFrame({"AAPL": [100.0, 110.0, 120.0, 130.0]}, index=idx)


def test_value_and_net_invested_with_sell():
    tx = make_tx(
        [
            ("2024-01-02", "AAPL", "BUY", 10, 100, 0),
            ("2024-01-04", "AAPL", "SELL", 5, 120, 0),
        ]
    )
    h = value_history(tx, closes())
    assert list(h["Portfolio value"]) == pytest.approx([1000, 1100, 600, 650])
    assert list(h["Net invested"]) == pytest.approx([1000, 1000, 400, 400])


def test_days_before_first_trade_are_dropped_and_value_is_zero_before_buy():
    tx = make_tx([("2024-01-04", "AAPL", "BUY", 1, 120, 2)])
    h = value_history(tx, closes())
    assert h.index.min() == pd.Timestamp("2024-01-04")
    assert list(h["Portfolio value"]) == pytest.approx([120, 130])
    assert list(h["Net invested"]) == pytest.approx([122, 122])


def test_weekend_trade_counts_from_next_trading_day():
    tx = make_tx([("2024-01-06", "AAPL", "BUY", 1, 130, 0)])
    idx = pd.to_datetime(["2024-01-05", "2024-01-08"])
    c = pd.DataFrame({"AAPL": [130.0, 140.0]}, index=idx)
    h = value_history(tx, c)
    assert list(h["Portfolio value"]) == pytest.approx([140])


def test_empty_inputs():
    assert value_history(make_tx([("2024-01-02", "AAPL", "BUY", 1, 1, 0)]), pd.DataFrame()).empty
