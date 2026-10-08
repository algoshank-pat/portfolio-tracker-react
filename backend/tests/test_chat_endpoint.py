"""Step C5: POST /api/chat end to end with the fake model (no key, no network)."""
import json
from dataclasses import replace

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.assistant.llm import UNAVAILABLE, AssistantUnavailable
from app.main import create_app
from tests.fakes import service
from tests.fakes_llm import fake
from tests.test_api import SAMPLE_CSV

IN_SCOPE = {"decision": "in_scope", "reason": "About this portfolio's XIRR.", "question_type": "xirr"}


def client(model=None, **overrides):
    svc = service()
    if overrides:
        svc.settings = replace(svc.settings, **overrides)

    def factory(_settings):
        if model is None:
            raise AssistantUnavailable()
        return model

    return TestClient(create_app(svc.settings, svc, chat_model_factory=factory))


def rows(c):
    return c.post("/api/transactions/validate", json={"csv": SAMPLE_CSV}).json()["transactions"]


def ask(c, message, history=None):
    r = c.post("/api/chat", json={"transactions": rows(c), "message": message, "history": history or []})
    return r, [json.loads(line) for line in r.text.splitlines() if line.strip()]


def test_in_scope_question_streams_every_step():
    m = fake(
        structured=[IN_SCOPE],
        replies=[
            AIMessage(content="", tool_calls=[{"name": "get_xirr", "args": {}, "id": "t1"}]),
            AIMessage(content="Your XIRR is shown above."),
        ],
    )
    r, ev = ask(client(m), "What is my XIRR?")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/x-ndjson")
    assert [e["type"] for e in ev] == ["received", "scope", "tool_call", "tool_result", "answer"]
    assert ev[1]["decision"] == "in_scope"
    assert ev[2] == {"type": "tool_call", "tool": "get_xirr", "args": {}, "turn": 1}
    assert ev[3]["summary"].startswith("XIRR +") and "live, as of 2026-01-02" in ev[3]["summary"]
    assert ev[4]["text"] == "Your XIRR is shown above." and ev[4]["tools_used"] == ["get_xirr"]  # tools: Activity only


def test_declined_question_runs_no_tools():
    m = fake(structured=[{"decision": "out_of_scope", "reason": "General knowledge.", "question_type": "general_knowledge"}])
    _, ev = ask(client(m), "Who won the World Cup?")
    assert [e["type"] for e in ev] == ["received", "scope", "declined"]
    assert ev[2]["activity"] == "Declined: not about this portfolio"
    assert m.replies == [] and len(m.seen) == 1  # only the scope check ran


def test_unclear_question_gets_one_clarifying_question():
    m = fake(structured=[{"decision": "unclear", "reason": "Vague.", "question_type": "other",
                          "clarifying_question": "Total return or XIRR?"}])
    _, ev = ask(client(m), "how am i doing")
    assert [e["type"] for e in ev] == ["received", "scope", "clarify"] and ev[2]["text"] == "Total return or XIRR?"


def test_no_key_means_unavailable_and_rest_of_app_works():
    c = client(None)
    _, ev = ask(c, "What is my XIRR?")
    assert ev == [{"type": "received", "chars": 16}, {"type": "error", "text": UNAVAILABLE}]
    assert c.post("/api/portfolio", json={"transactions": rows(c)}).status_code == 200


def test_message_cap_and_empty_message_are_422_before_any_llm_call():
    m = fake()
    c = client(m)
    r = c.post("/api/chat", json={"transactions": rows(c), "message": "x" * 501})
    assert r.status_code == 422 and "at most 500 characters" in r.json()["errors"][0]
    assert c.post("/api/chat", json={"transactions": rows(c), "message": "   "}).status_code == 422
    assert m.seen == []


def test_bad_transactions_rejected_like_everywhere_else():
    c = client(fake())
    bad = [{"trade_date": "2024-01-02", "ticker": "AAPL", "side": "SELL", "quantity": 5, "price": 1}]
    r = c.post("/api/chat", json={"transactions": bad, "message": "What is my XIRR?"})
    assert r.status_code == 422 and "only 0 held" in r.json()["errors"][0]


def test_history_is_trimmed_to_last_10():
    m = fake(structured=[{"decision": "unclear", "reason": "Vague.", "question_type": "other"}])
    hist = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}" + "y" * 600} for i in range(14)]
    ask(client(m), "and?", hist)
    sent = m.seen[0][1:-1]  # between the system prompt and the question
    assert len(sent) == 10 and sent[0].content.startswith("m4") and all(len(x.content) == 500 for x in sent)
