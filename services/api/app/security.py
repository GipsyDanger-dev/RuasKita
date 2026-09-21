"""Local security boundary until authenticated production access exists."""

from __future__ import annotations

import os

DEFAULT_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def allowed_origins() -> list[str]:
    configured = os.getenv("RUASKITA_ORIGINS")
    values = configured.split(",") if configured else list(DEFAULT_ORIGINS)
    return list(dict.fromkeys(value.strip() for value in values if value.strip()))


def is_loopback_host(host: str | None) -> bool:
    return host in {"127.0.0.1", "::1", "testclient"}


def origin_is_allowed(origin: str | None) -> bool:
    return not origin or origin in allowed_origins()
