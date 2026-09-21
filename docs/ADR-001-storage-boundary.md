# ADR-001: Keep local storage behind an explicit adapter boundary

## Status

Accepted for the desktop MVP; PostgreSQL/PostGIS adapter pending.

## Context

The desktop slice must run without cloud credentials and must remain safe on
loopback. SQLite is useful for isolated E2E and manual reporting, but its JSON
aggregate tables are not a production geospatial or identity store.

## Decision

- Domain operations use `services/api/app/storage.py` for local connection and
  schema bootstrapping.
- `RUASKITA_STORAGE_BACKEND=sqlite` is the only configured backend in this
  release. Any other value reports `not_ready` instead of silently falling back.
- The target normalized PostgreSQL/PostGIS schema is documented in
  `services/api/migrations/001_incident_intelligence.sql`.
- The HTTP contract stays stable while the storage adapter changes.
- Incident creation remains idempotent through a client `request_id`; future
  adapters must preserve that invariant with a unique database constraint.

## Consequences

Local tests stay fast and deterministic. Production migration still requires a
real PostGIS adapter, authenticated identities, private object storage, and a
data migration from the SQLite aggregate shape. The API does not claim those
capabilities until they are implemented and verified.
