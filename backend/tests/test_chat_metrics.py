"""Step M1: one privacy-safe metrics log line per question (SPEC.md A15)."""
import json
import logging
import re

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.main import create_app
from tests.fakes import FakeLive, service
from tests.fakes_llm import fake
from tests.test_api import SAMPLE_CSV

IN_SCOPE = {"decision": "in_scope", "reason": "About this portfolio.", "question_type": "xirr"}
USAGE = {"input_tokens": 1000, "output_tokens": 100, "total_tokens": 1100}
SECRET_QUESTION = "ZEBRA-QUESTION about my position worth 98765"


def ask(model, message=SECRET_QUESTION, prices=None):
    svc = prices or service()
    c = TestClient(create_app(svc.settings, svc, chat_model_factory=lambda _s: model), raise_server_exceptions=False)
    tx = c.post("/api/transactions/validate", json={"csv": SAMPLE_CSV}).json()["transactions"]
    r = c.post("/api/chat", json={"transactions": tx, "message": message})
    return [json.loads(x) for x in r.text.splitlines() if x.strip()]


def metrics_line(caplog) -> str:
    lines = [r.getMessage() for r in caplog.records if r.name == "portfolio_tracker.metrics"]
    assert len(lines) == 1, lines
    return lines[0]


def fields(line: str) -> dict[str, str]:
    return dict(re.findall(r"(\w+)=(\S+)", line))


def test_answer_line_has_every_field_and_adds_up_tokens_and_cost(caplog):
    caplog.set_level(logging.INFO)
    m = fake(structured=[IN_SCOPE], replies=[
        AIMessage(content="", tool_calls=[{"name": "get_xirr", "args": {}, "id": "1"}], usage_metadata=USAGE),
        AIMessage(content="Your XIRR is shown.", usage_metadata=USAGE),
    ])
    ask(m)
    f = fields(metrics_line(caplog))
    assert f["outcome"] == "answer" and f["decision"] == "in_scope" and f["type"] == "xirr"
    assert f["tools"] == "get_xirr" and f["turns"] == "1" and int(f["ms"]) >= 0
    # scope check 400 + 30 (fake raw usage) + two replies of 1000 + 100
    assert f["in_tokens"] == "2400" and f["out_tokens"] == "230"
    assert f["est_cost_usd"] == "0.00036"  # 2400 x $0.10/M + 230 x $0.50/M = 0.00024 + 0.000115 = 0.000355, 5 decimals


def test_declined_question_still_logs_one_line(caplog):
    caplog.set_level(logging.INFO)
    ask(fake(structured=[{"decision": "out_of_scope", "reason": "Advice.", "question_type": "advice"}]))
    f = fields(metrics_line(caplog))
    assert (f["outcome"], f["decision"], f["type"], f["tools"], f["turns"]) == ("declined", "out_of_scope", "advice", "-", "0")
    assert f["in_tokens"] == "400" and f["out_tokens"] == "30"


def test_model_failure_logs_an_error_line(caplog):
    caplog.set_level(logging.INFO)
    ask(fake(structured=[ConnectionError("network down")]))
    f = fields(metrics_line(caplog))
    assert f["outcome"] == "error" and f["decision"] == "-" and f["in_tokens"] == "0"


def test_metrics_line_never_contains_text_tickers_or_amounts(caplog):
    caplog.set_level(logging.DEBUG)
    m = fake(structured=[{**IN_SCOPE, "question_type": "holdings"}], replies=[
        AIMessage(content="", tool_calls=[{"name": "what_if", "args": {"side": "SELL", "ticker": "VTI", "quantity": 2}, "id": "1"}]),
        AIMessage(content="Selling 2 VTI would bring in $600.00."),
    ])
    ask(m, prices=service(FakeLive()))
    line = metrics_line(caplog)
    for secret in ("ZEBRA", "98765", "VTI", "AAPL", "MSFT", "600", "12,260", "Selling", "sk-ant"):
        assert secret not in line, secret
    assert fields(line)["tools"] == "what_if"
