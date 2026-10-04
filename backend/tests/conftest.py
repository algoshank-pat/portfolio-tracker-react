from pathlib import Path

import pytest

from app.core.transactions import parse_csv

SAMPLE = Path(__file__).parent.parent / "data" / "sample_transactions.csv"


@pytest.fixture
def sample_tx():
    return parse_csv(SAMPLE)
