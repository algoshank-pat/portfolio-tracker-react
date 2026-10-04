from datetime import date

import numpy as np
import pandas as pd

from app.core.prices import DemoProvider, _close_frame


def test_close_frame_multiindex_and_flat_shapes():
    idx = pd.to_datetime(["2024-01-02", "2024-01-03"]).tz_localize("America/New_York")
    multi = pd.DataFrame(
        np.arange(8, dtype=float).reshape(2, 4),
        index=idx,
        columns=pd.MultiIndex.from_product([["Close", "Open"], ["AAPL", "MSFT"]]),
    )
    out = _close_frame(multi, ["AAPL", "MSFT"])
    assert list(out.columns) == ["AAPL", "MSFT"] and out.index.tz is None and out.iloc[0, 0] == 0.0

    flat = pd.DataFrame({"Close": [1.0, 2.0], "Open": [1.0, 2.0]}, index=idx)
    out = _close_frame(flat, ["AAPL"])
    assert list(out.columns) == ["AAPL"] and out["AAPL"].iloc[-1] == 2.0

    assert _close_frame(pd.DataFrame(), ["AAPL"]).empty


def test_demo_provider_is_deterministic_and_labelled():
    p = DemoProvider()
    a = p.history(["AAPL"], date(2024, 1, 1), date(2024, 3, 1))
    b = p.history(["AAPL"], date(2024, 1, 1), date(2024, 3, 1))
    pd.testing.assert_frame_equal(a, b)
    assert "SYNTHETIC" in p.name
    assert "AAPL" in p.latest(["AAPL"])
