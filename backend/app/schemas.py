"""Request models. Rows stay loosely typed so the core validator can report every problem with row numbers."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ValidateRequest(BaseModel):
    csv: str | None = None
    rows: list[dict[str, Any]] | None = None


class TransactionsRequest(BaseModel):
    transactions: list[dict[str, Any]]
