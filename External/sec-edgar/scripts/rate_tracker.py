

"""Proactive SEC EDGAR rate-limit tracker.

Tracks request timestamps over a rolling 60-second window and:
- Records each request made
- Calculates recommended wait time before next request
- Detects when we're approaching SEC's 10 req/s limit
- Sets a cooldown period after a 503 response

Usage:
    tracker = RateLimitTracker()
    tracker.wait_if_needed()   # sleep before making a request
    tracker.record_request()   # call after each request
    # ... make request ...
    if response.status == 503:
        tracker.set_rate_limited(minutes=10)
"""

from __future__ import annotations
import sys as _s; _s.path.insert(0, "/home/workspace")

import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from Skills.sec_edgar.scripts.config import get_rate_limit_delay, get_rate_limit_jitter


# SEC allows max 10 req/s. We target ~5.5–7 req/s for safety margin.
SEC_REQUESTS_PER_SECOND = 10
SAFE_REQUESTS_PER_SECOND = 7  # upper bound of our target range
SAFE_REQUESTS_PER_MINUTE = SAFE_REQUESTS_PER_SECOND * 60  # 420

RATE_LIMIT_COOLDOWN_MINUTES = 10


@dataclass
class RateLimitState:
    """Immutable-ish snapshot of rate limit state at a point in time."""
    requests: list[float] = field(default_factory=list)
    rate_limited_until: float | None = None
    last_request_time: float | None = None


class RateLimitTracker:
    """Tracks SEC EDGAR request rate and enforces sleep intervals.

    Thread-safe for single-process use. Not safe across multiple processes
    sharing the same state — each process tracks independently.
    """

    def __init__(
        self,
        delay: float | None = None,
        jitter_range: tuple[float, float] | None = None,
    ):
        self._delay = delay if delay is not None else get_rate_limit_delay()
        self._jitter_range = jitter_range or get_rate_limit_jitter()
        self._requests: list[float] = []  # timestamps
        self._rate_limited_until: float | None = None
        self._last_request_time: float | None = None

    # ── Public API ─────────────────────────────────────────────────────────────

    def wait_if_needed(self) -> None:
        """Sleep if necessary to stay within the safe request rate."""
        wait = self.get_wait_time()
        if wait > 0:
            time.sleep(wait)

    def record_request(self) -> None:
        """Record that a request was made right now."""
        now = time.time()
        self._requests.append(now)
        self._last_request_time = now
        self._trim_requests()

    def set_rate_limited(self, minutes: int = RATE_LIMIT_COOLDOWN_MINUTES) -> None:
        """Mark that we hit a 503 and must cooldown."""
        self._rate_limited_until = time.time() + (minutes * 60)

    def is_rate_limited(self) -> bool:
        """True if we're in a cooldown period after a 503."""
        if self._rate_limited_until is None:
            return False
        if time.time() >= self._rate_limited_until:
            self._rate_limited_until = None
            return False
        return True

    def get_wait_time(self) -> float:
        """Seconds to wait before the next request (0 if ok to proceed)."""
        # Cooldown after 503
        if self.is_rate_limited():
            remaining = self._rate_limited_until - time.time()
            return max(remaining, 0)

        # Proactive throttling — if we've made > SAFE_REQUESTS_PER_MINUTE
        # requests in the last 60s, throttle back
        self._trim_requests()
        recent = len(self._requests)
        if recent >= SAFE_REQUESTS_PER_MINUTE:
            return 2.0  # wait 2s to cool down

        # Standard delay between requests
        if self._last_request_time is not None:
            elapsed = time.time() - self._last_request_time
            wait = self._delay - elapsed
            if wait < 0:
                wait = 0
            # Add jitter
            jitter = random.uniform(*self._jitter_range)
            return wait + jitter

        return 0

    def get_state(self) -> RateLimitState:
        """Return a snapshot of current state (useful for debugging)."""
        self._trim_requests()
        return RateLimitState(
            requests=list(self._requests),
            rate_limited_until=self._rate_limited_until,
            last_request_time=self._last_request_time,
        )

    def get_requests_in_last_minute(self) -> int:
        """Count requests made in the last 60 seconds."""
        self._trim_requests()
        return len(self._requests)

    def reset(self) -> None:
        """Clear all state (useful between batch runs)."""
        self._requests.clear()
        self._rate_limited_until = None
        self._last_request_time = None

    # ── Internal ───────────────────────────────────────────────────────────────

    def _trim_requests(self) -> None:
        """Remove requests older than 60 seconds from the rolling window."""
        cutoff = time.time() - 60
        self._requests = [t for t in self._requests if t > cutoff]


class RateLimitError(Exception):
    """Raised when SEC rate limit is exceeded and we should cooldown."""

    def __init__(self, message: str, retry_after_minutes: int = 10):
        super().__init__(message)
        self.retry_after_minutes = retry_after_minutes


def rate_limited(func):
    """Decorator that enforces rate limiting around a function.

    The decorated function must be a method of a RateLimitTracker subclass
    or accept a 'tracker' kwarg.

    Usage (method decorator):
        class MyFetcher:
            def __init__(self):
                self.tracker = RateLimitTracker()

            @rate_limited
            def fetch(self, url: str) -> bytes:
                ...
    """
    import functools
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Find tracker from self (method) or kwargs
        tracker: RateLimitTracker | None = None
        if hasattr(args[0], "tracker") if args else False:
            tracker = getattr(args[0], "tracker")
        tracker = kwargs.pop("tracker", tracker)

        if tracker is None:
            raise ValueError("rate_limited decorator requires a tracker")

        tracker.wait_if_needed()
        try:
            result = func(*args, **kwargs)
            tracker.record_request()
            return result
        except RateLimitError:
            tracker.set_rate_limited()
            raise

    return wrapper
