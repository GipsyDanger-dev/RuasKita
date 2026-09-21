"""Storage boundary for the local MVP.

The current adapter is intentionally SQLite-only.  Keeping connection setup,
schema bootstrapping, and backend metadata here gives the domain operations a
stable seam for the future PostgreSQL/PostGIS adapter.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA_VERSION = 2


def storage_backend() -> str:
    return os.environ.get("RUASKITA_STORAGE_BACKEND", "sqlite").strip().lower()


def database_path() -> Path:
    return Path(
        os.environ.get(
            "RUASKITA_DB",
            str(Path(__file__).resolve().parents[1] / "data" / "workspace.sqlite3"),
        )
    )


def _ensure_sqlite_schema(db: sqlite3.Connection) -> None:
    current_version = db.execute("PRAGMA user_version").fetchone()[0]
    if current_version > SCHEMA_VERSION:
        raise RuntimeError(
            f"Database schema {current_version} is newer than supported {SCHEMA_VERSION}."
        )
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, image BLOB NOT NULL, analysis TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS incident_idempotency (
            request_id TEXT PRIMARY KEY,
            incident_id TEXT NOT NULL
        );
        """
    )
    if current_version < SCHEMA_VERSION:
        db.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


@contextmanager
def database() -> Iterator[sqlite3.Connection]:
    """Open a serialized local transaction through the active storage adapter."""

    backend = storage_backend()
    if backend != "sqlite":
        raise RuntimeError(
            f"Storage backend '{backend}' is not configured in this local release. "
            "Use RUASKITA_STORAGE_BACKEND=sqlite until the PostgreSQL adapter lands."
        )
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    try:
        _ensure_sqlite_schema(db)
        db.execute("BEGIN IMMEDIATE")
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def storage_metadata() -> dict[str, str | int]:
    """Expose truthful storage state for diagnostics and readiness checks."""

    return {
        "backend": storage_backend(),
        "schema_version": SCHEMA_VERSION,
        "path": str(database_path()),
    }
