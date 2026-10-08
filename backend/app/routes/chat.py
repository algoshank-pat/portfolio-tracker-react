"""POST /api/chat: the "Ask your portfolio" assistant as a stream of NDJSON events (SPEC.md A8)."""
import json
from typing import Any, Iterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

import app.assistant  # noqa: F401  (forces LangSmith/LangChain tracing off before LangChain loads)
from app.assistant.llm import UNAVAILABLE, AssistantUnavailable
from app.core.transactions import ValidationError
from app.schemas import ChatRequest
from app.services import portfolio as svc

router = APIRouter(prefix="/api")


def _ndjson(events: Iterator[dict[str, Any]]) -> Iterator[bytes]:
    for e in events:
        yield (json.dumps(e) + "\n").encode()


@router.post("/chat")
def chat(body: ChatRequest, request: Request) -> StreamingResponse:
    settings = request.app.state.settings
    message = body.message.strip()
    if not message:
        raise ValidationError(["Please type a question."])
    if len(message) > settings.chat_max_message_chars:
        raise ValidationError([f"Questions can be at most {settings.chat_max_message_chars} characters."])
    tx = svc.validate_rows(body.transactions, settings)  # same caps and checks as every other endpoint
    history = [(t.role, t.content[: settings.chat_max_message_chars]) for t in body.history][-settings.chat_max_history :]

    def events() -> Iterator[dict[str, Any]]:
        try:
            model = request.app.state.chat_model_factory(settings)
        except AssistantUnavailable:
            yield {"type": "received", "chars": len(message)}
            yield {"type": "error", "text": UNAVAILABLE}
            return
        from app.assistant.chat import run_chat  # LangChain loads on the first question, not at startup

        yield from run_chat(model, tx, request.app.state.prices, message, history, settings)

    return StreamingResponse(
        _ndjson(events()),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
