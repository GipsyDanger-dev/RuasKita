-- Target PostgreSQL/PostGIS schema for the next storage adapter.
-- This migration is a contract artifact only; the local MVP still uses SQLite.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    road TEXT NOT NULL,
    road_normalized TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    status TEXT NOT NULL CHECK (status IN ('candidate', 'verified', 'assigned', 'in_repair', 'recheck', 'resolved')),
    source TEXT NOT NULL CHECK (source IN ('manual', 'ai', 'imported')),
    model_version TEXT,
    location_confidence DOUBLE PRECISION CHECK (location_confidence IS NULL OR location_confidence BETWEEN 0 AND 1),
    assignee TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL,
    contributor TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS incidents_location_gix
    ON incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS incidents_road_normalized_idx
    ON incidents (road_normalized);
CREATE INDEX IF NOT EXISTS incidents_status_idx
    ON incidents (status);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    storage_key TEXT NOT NULL,
    media_type TEXT NOT NULL,
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    analysis JSONB,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    evidence_id TEXT NOT NULL REFERENCES evidence(id),
    kind TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'ai', 'imported')),
    model_version TEXT,
    contributor TEXT NOT NULL,
    notes TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    UNIQUE (incident_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS incident_history (
    id BIGSERIAL PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    road TEXT NOT NULL DEFAULT '',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    snapshot JSONB NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_idempotency (
    request_id UUID PRIMARY KEY,
    incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL
);
