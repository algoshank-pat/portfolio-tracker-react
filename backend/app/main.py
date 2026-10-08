"""FastAPI entry point. Run locally with: uv run uvicorn app.main:app --reload"""
from __future__ import annotations

import logging
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.assistant.llm import build_chat_model
from app.config import Settings
from app.core.transactions import ValidationError
from app.limits import BodySizeLimit, BodyTooLarge, RateLimit, RateLimiter
from app.pricing.service import PriceService
from app.routes import chat, health, performance, portfolio, transactions

log = logging.getLogger("portfolio_tracker")


def _readable(err: dict) -> str:
    where = ".".join(str(p) for p in err.get("loc", ()) if p != "body")
    return f"{where}: {err.get('msg', 'invalid value')}" if where else err.get("msg", "Invalid request.")


def create_app(
    settings: Settings | None = None,
    prices: PriceService | None = None,
    chat_model_factory: Callable | None = None,
) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="Portfolio Tracker API", version="0.1.0", docs_url="/docs", redoc_url=None)
    app.state.settings = settings
    app.state.prices = prices or PriceService(settings)
    app.state.chat_model_factory = chat_model_factory or build_chat_model

    @app.exception_handler(ValidationError)
    async def _validation(_req: Request, exc: ValidationError):
        return JSONResponse(status_code=422, content={"errors": exc.errors})

    @app.exception_handler(RequestValidationError)
    async def _bad_shape(_req: Request, exc: RequestValidationError):
        # Messages only; never echo or log the request body.
        return JSONResponse(status_code=422, content={"errors": [_readable(e) for e in exc.errors()][:20]})

    @app.exception_handler(StarletteHTTPException)
    async def _http(_req: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"errors": [str(exc.detail)]})

    @app.middleware("http")
    async def _unexpected(req: Request, call_next):
        # Caught here (not via an Exception handler) so uvicorn never prints a traceback,
        # whose messages could echo request values. Log only the type and path.
        try:
            return await call_next(req)
        except BodyTooLarge:
            raise  # BodySizeLimit turns this into a 413
        except Exception as exc:  # noqa: BLE001
            log.error("Unhandled %s on %s", type(exc).__name__, req.url.path)
            return JSONResponse(status_code=500, content={"errors": ["Something went wrong on the server."]})

    app.include_router(health.router)
    app.include_router(transactions.router)
    app.include_router(portfolio.router)
    app.include_router(performance.router)
    app.include_router(chat.router)

    # Added last = outermost, so even 413/429 responses carry CORS headers.
    app.add_middleware(BodySizeLimit, max_bytes=settings.max_body_bytes)
    app.add_middleware(RateLimit, limiter=RateLimiter(settings.rate_limit_per_minute))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
        max_age=600,
    )
    return app


app = create_app()
