"""Public-safety guards: request body cap and a per-IP rate limit.

Neither guard reads or logs request bodies beyond counting bytes.
"""
from __future__ import annotations

import json
import threading
import time
from collections import deque
from typing import Callable

from starlette.types import ASGIApp, Message, Receive, Scope, Send


async def _send_json(send: Send, status: int, message: str, headers: list | None = None) -> None:
    body = json.dumps({"errors": [message]}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
            + (headers or []),
        }
    )
    await send({"type": "http.response.body", "body": body})


class BodyTooLarge(Exception):
    pass


class BodySizeLimit:
    """Reject bodies over `max_bytes` (checks Content-Length and counts streamed bytes)."""

    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        message = f"Request is too large (limit {self.max_bytes / 1_000_000:g} MB)."
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    if int(value) > self.max_bytes:
                        await _send_json(send, 413, message)
                        return
                except ValueError:
                    pass

        # No (honest) Content-Length: count streamed bytes. Once over the cap, stop reading,
        # hand the app an empty final chunk, and replace whatever it answers with a 413.
        seen = 0
        too_large = False
        replaced = False

        async def counting_receive() -> Message:
            nonlocal seen, too_large
            if too_large:
                return {"type": "http.request", "body": b"", "more_body": False}
            msg = await receive()
            if msg["type"] == "http.request":
                seen += len(msg.get("body", b""))
                if seen > self.max_bytes:
                    too_large = True
                    return {"type": "http.request", "body": b"", "more_body": False}
            return msg

        async def guarded_send(msg: Message) -> None:
            nonlocal replaced
            if too_large:
                if not replaced:
                    replaced = True
                    await _send_json(send, 413, message)
                return
            await send(msg)

        try:
            await self.app(scope, counting_receive, guarded_send)
        except BodyTooLarge:
            if not replaced:
                await _send_json(send, 413, message)


class RateLimiter:
    """Sliding one-minute window per client IP, in memory (one worker process)."""

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic):
        self.per_minute = per_minute
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> tuple[bool, int]:
        """(allowed, seconds to wait if not)."""
        now = self._clock()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and q[0] <= now - 60:
                q.popleft()
            if len(q) >= self.per_minute:
                return False, max(1, int(60 - (now - q[0])) + 1)
            q.append(now)
            if len(self._hits) > 10_000:  # drop idle clients so memory stays bounded
                for k in [k for k, v in self._hits.items() if not v or v[-1] <= now - 60]:
                    del self._hits[k]
            return True, 0


def client_ip(scope: Scope) -> str:
    """First address in X-Forwarded-For (set by the hosting proxy), else the socket peer."""
    for name, value in scope.get("headers", []):
        if name == b"x-forwarded-for":
            first = value.decode("latin-1").split(",")[0].strip()
            if first:
                return first
    client = scope.get("client")
    return client[0] if client else "unknown"


class RateLimit:
    """Apply `RateLimiter` to paths under /api/."""

    def __init__(self, app: ASGIApp, limiter: RateLimiter):
        self.app = app
        self.limiter = limiter

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["path"].startswith("/api/") and scope["method"] != "OPTIONS":
            ok, wait = self.limiter.allow(client_ip(scope))
            if not ok:
                await _send_json(
                    send,
                    429,
                    f"Too many requests. Please wait {wait} seconds and try again.",
                    [(b"retry-after", str(wait).encode())],
                )
                return
        await self.app(scope, receive, send)
