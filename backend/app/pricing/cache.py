"""In-memory TTL cache with single-flight: concurrent misses for one key share one fetch.

One worker process is assumed (see SPEC.md), so a plain dict plus a lock is enough.
"""
from __future__ import annotations

import threading
import time
from concurrent.futures import Future
from typing import Callable, Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self._clock = clock
        self._lock = threading.Lock()
        self._values: dict[str, tuple[float, T]] = {}
        self._inflight: dict[str, Future] = {}

    def get(self, key: str) -> T | None:
        with self._lock:
            hit = self._values.get(key)
            if hit is None:
                return None
            expires, value = hit
            if expires <= self._clock():
                del self._values[key]
                return None
            return value

    def set(self, key: str, value: T, ttl_s: float) -> None:
        with self._lock:
            self._values[key] = (self._clock() + ttl_s, value)

    def get_or_fetch(
        self,
        key: str,
        fetch: Callable[[], T],
        ttl_s: float,
        is_fresh: Callable[[T], bool] = lambda _v: True,
        timeout_s: float | None = None,
    ) -> T:
        """Return a fresh cached value or run `fetch` once, shared by concurrent callers.

        Exceptions from `fetch` are raised to every waiting caller and nothing is cached.
        """
        with self._lock:
            hit = self._values.get(key)
            if hit is not None and hit[0] > self._clock() and is_fresh(hit[1]):
                return hit[1]
            fut = self._inflight.get(key)
            owner = fut is None
            if owner:
                fut = Future()
                self._inflight[key] = fut
        if owner:
            try:
                value = fetch()
            except BaseException as exc:
                fut.set_exception(exc)
                raise
            else:
                self.set(key, value, ttl_s)
                fut.set_result(value)
                return value
            finally:
                with self._lock:
                    self._inflight.pop(key, None)
        return fut.result(timeout=timeout_s)
