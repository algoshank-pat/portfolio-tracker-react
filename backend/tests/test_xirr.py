from datetime import date

import pytest

from app.core.xirr import xirr


def npv(rate, flows):
    t0 = min(d for d, _ in flows)
    return sum(a / (1 + rate) ** ((d - t0).days / 365) for d, a in flows)


def test_single_period_closed_form():
    flows = [(date(2024, 1, 1), -1000.0), (date(2025, 1, 1), 1100.0)]
    expected = 1.1 ** (365 / 366) - 1
    assert xirr(flows) == pytest.approx(expected, abs=1e-6)


def test_two_years():
    flows = [(date(2023, 1, 1), -1000.0), (date(2025, 1, 1), 1210.0)]
    expected = 1.21 ** (365 / 731) - 1
    assert xirr(flows) == pytest.approx(expected, abs=1e-6)


def test_multiple_flows_npv_is_zero():
    flows = [
        (date(2023, 1, 1), -1000.0),
        (date(2023, 7, 1), -500.0),
        (date(2024, 1, 1), 300.0),
        (date(2025, 1, 1), 1500.0),
    ]
    r = xirr(flows)
    assert r is not None
    assert npv(r, flows) == pytest.approx(0, abs=1e-5)


def test_negative_return():
    flows = [(date(2024, 1, 1), -1000.0), (date(2025, 1, 1), 800.0)]
    assert xirr(flows) < 0


def test_cannot_compute_returns_none():
    assert xirr([(date(2024, 1, 1), -100.0)]) is None
    assert xirr([(date(2024, 1, 1), -100.0), (date(2024, 6, 1), -50.0)]) is None
    assert xirr([]) is None
