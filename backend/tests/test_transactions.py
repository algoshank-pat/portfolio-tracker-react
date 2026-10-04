import io

import pandas as pd
import pytest

from app.core.transactions import (
    ValidationError,
    add_transaction,
    empty_transactions,
    normalize,
    parse_csv,
)


def csv(text: str):
    return io.StringIO(text.strip() + "\n")


def test_sample_parses(sample_tx):
    assert len(sample_tx) == 7
    assert set(sample_tx["side"]) == {"BUY", "SELL"}
    assert sample_tx["trade_date"].is_monotonic_increasing


def test_normalizes_case_and_whitespace():
    tx = parse_csv(csv("Trade_Date, Ticker ,Side,Quantity,Price\n2024-01-02, aapl ,buy,1,10"))
    assert tx.loc[0, "ticker"] == "AAPL"
    assert tx.loc[0, "side"] == "BUY"
    assert tx.loc[0, "fees"] == 0.0


def test_missing_required_column():
    with pytest.raises(ValidationError) as e:
        parse_csv(csv("trade_date,ticker,side,quantity\n2024-01-02,AAPL,BUY,1"))
    assert "price" in e.value.errors[0]


def test_reports_every_bad_row_and_imports_nothing():
    text = """trade_date,ticker,side,quantity,price,fees
2024-01-02,AAPL,BUY,1,10,0
not-a-date,AAPL,BUY,1,10,0
2024-01-03,AAPL,HOLD,1,10,0
2024-01-04,AAPL,BUY,-5,10,0
2024-01-05,AAPL,BUY,1,abc,0
"""
    with pytest.raises(ValidationError) as e:
        parse_csv(csv(text))
    joined = " ".join(e.value.errors)
    for row in ("Row 3", "Row 4", "Row 5", "Row 6"):
        assert row in joined
    assert "Row 2" not in joined


def test_oversell_rejected():
    text = """trade_date,ticker,side,quantity,price
2024-01-02,AAPL,BUY,5,10
2024-01-03,AAPL,SELL,6,12
"""
    with pytest.raises(ValidationError) as e:
        parse_csv(csv(text))
    assert "only 5 held" in e.value.errors[0]


def test_same_day_buy_before_sell_is_ok():
    text = """trade_date,ticker,side,quantity,price
2024-01-02,AAPL,SELL,5,12
2024-01-02,AAPL,BUY,5,10
"""
    tx = parse_csv(csv(text))
    assert list(tx["side"]) == ["BUY", "SELL"]


def test_empty_file_errors():
    with pytest.raises(ValidationError):
        parse_csv(io.StringIO(""))
    with pytest.raises(ValidationError):
        parse_csv(csv("trade_date,ticker,side,quantity,price"))


def test_add_transaction_validates_against_existing(sample_tx):
    with pytest.raises(ValidationError):
        add_transaction(sample_tx, pd.Timestamp("2025-06-01"), "AAPL", "SELL", 100, 200, 0)
    out = add_transaction(sample_tx, pd.Timestamp("2025-06-01"), "AAPL", "BUY", 1, 200, 0)
    assert len(out) == len(sample_tx) + 1


def test_add_to_empty():
    out = add_transaction(empty_transactions(), pd.Timestamp("2024-01-02"), "msft", "buy", 2, 300, 1)
    assert len(out) == 1 and out.loc[0, "ticker"] == "MSFT"


def test_normalize_is_idempotent(sample_tx):
    pd.testing.assert_frame_equal(normalize(sample_tx), sample_tx)
