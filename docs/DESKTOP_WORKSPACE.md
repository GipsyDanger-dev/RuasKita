# Desktop workspace — local MVP

This slice implements the desktop-first direction agreed with the user. It does
not complete the full 12-sprint PRD or claim production / field readiness.

## Run

From the repository root, in one terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd apps/web
npm ci
npm run dev
```

Open http://localhost:3000/dashboard. The existing approved home composition is
retained at `/`, with its illustrative score explicitly labelled. Operational
pages start empty; they never silently seed or mix demo incidents into real data.

The API reads the frozen model manifest, verifies the checkpoint SHA-256 when the
checkpoint is available, and then loads it.
It uses CUDA when available, otherwise CPU. Missing checkpoint means analysis
returns HTTP 503; manual reporting remains available. No training is started.

## Working routes

- `/dashboard`: counts derived from saved incidents, manual attention ranking,
  oldest first within each severity; refresh action.
- `/map`: MapLibre pan/zoom, OpenStreetMap basemap, coordinate-linked markers,
  search/status filtering, selected incident and detail link. List and coordinate
  inputs remain usable if basemap requests fail. Refresh is explicit, not realtime.
- `/roads`: grouping by reported road name, incident/evidence counts, linked list.
- `/incidents`: search, severity/status filter, ten-row pagination.
- `/incidents/new`: validated image upload, optional actual RuasVision analysis,
  polygon overlay, map point selection or device GPS, manual severity, notes,
  named contributor, persistent candidate creation.
- `/incidents/:id`: metadata, image navigation, stored AI results, event history,
  guarded status transitions and additional observations on the same incident.
- `/repairs`: stage board, search by road/assignee, optional resolved column;
  each item opens the incident actions.
- `/ruasview`: per-incident image history, previous/next, timeline, AI overlay,
  first/latest comparison and location context. This is not continuous street view.
- `/analytics`: date filters on incident creation (UTC), status and attention
  distributions, derived counts and JSON export.
- `/reports`: date/road-filtered immutable snapshot creation and history.
- `/reports/:id`: print/save PDF through the browser, snapshot JSON export,
  SHA-256 snapshot integrity check. Clearly labelled internal draft, not verified PDF.
- `/contributors`: observation counts grouped by entered name, linked incidents.
  Names are not authenticated identities.
- `/system`: connection/model status, storage/auth limitations, retry and startup
  instructions. Theme selection is shared with the homepage and persisted locally.

## Data and safety

Local development storage is SQLite at `services/api/data/workspace.sqlite3`,
ignored by Git. Configure `RUASKITA_DB` to use another explicit file. This choice
allows the desktop workflow to run without cloud credentials; PostgreSQL/PostGIS
and Supabase remain the intended production architecture.

Tables: `incidents` (versioned JSON aggregate), `evidence` (sanitized JPEG bytes and
server-generated AI result), `reports` (immutable snapshot and canonical JSON hash).
The SQLite adapter reports schema version `2` and is isolated behind
`services/api/app/storage.py`; this is the migration seam for PostgreSQL/PostGIS.
All SQL uses bound parameters. Read/modify/write transactions serialize concurrent
updates. Revision conflicts return 409 instead of silently overwriting changes.
Creation request UUIDs make retrying the same submission idempotent.
New incidents also preserve source provenance, optional model release,
location confidence, and a normalized road comparison key. The review-only
`POST /v1/incidents/duplicate-candidates` endpoint uses those coordinates and
road names to return explainable candidates without merging records.

Photo uploads accept JPEG/PNG/WebP, max 10 MB and 25 megapixels. Photos are oriented,
re-encoded as JPEG, stripped of EXIF, and limited to 2400px before storage/inference.
Original photos are not retained. Face/plate blurring is **not implemented**; use
non-identifying evidence locally and do not publish this storage.

State machine:

```text
candidate → verified (manual review) → assigned → in_repair → recheck → resolved
                                                  ↑           |
                                                  +-----------+
resolved → candidate (reopen)
```

Assignment requires a responsible person/team. Recheck requires a newly uploaded
repair image. Each transition requires a note. Additional observations do not
automatically change status. UI resolution also asks the operator to confirm a
manual review; none of these states certify field conditions.

There is no public auth yet. The API rejects non-loopback clients and unapproved
write origins. Keep both servers bound to localhost. Do not expose them through a
reverse proxy: that would require authenticated identities, RBAC, CSRF/rate limits,
signed evidence access, proper secrets management, and an operational security review.
Default browser origins are localhost/127.0.0.1 port 3000; `RUASKITA_ORIGINS` can set
an explicit comma-separated development allowlist.

Snapshots deep-copy the incident data at generation time. SHA-256 is computed on
canonical UTF-8 JSON (`sort_keys=True`, compact separators, non-ASCII retained).
It detects changes to the stored snapshot relative to its saved hash. It is **not**
a digital signature, PDF-byte checksum, or independent proof of authenticity.
PDF is a browser printout, not the PRD's QR-verified official report.

## Verification

```powershell
# Isolated temporary SQLite database; model disabled, no training.
.\.venv\Scripts\python.exe -m unittest discover -s services/api/tests -v

cd apps/web
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E starts its own API at 8800 and Next dev at 3100 with a fresh temporary database.
It refuses to reuse existing servers, disables inference weights, and tests manual
fallback on 503. It covers the full lifecycle, observations, persistence on reload,
filters, map markers, RuasView comparison, report creation/hash/export/print,
all module routes, dark/light persistence, responsive overflow, and API retry.
Test screenshots/PDF/traces are ignored by Git. API tests require `httpx` in the
development environment. E2E leaves a temporary database for failure investigation.

Basemap implementation follows the [official MapLibre raster source example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-raster-tile-source/).
Tiles require network access; a production tile provider and capacity plan are
still needed before public rollout.

## Explicitly deferred

- Supabase Auth, RBAC, Postgres/PostGIS/pgvector, cloud storage, Redis workers and realtime.
- GeoFusion, road-segment matching, automatic spatial/visual duplicate merging.
- Calibrated severity, Road Health Score and automatic repair priority scoring.
- Metric depth/dimensions; no centimetre estimate is emitted.
- Street capture sequences, automated before/after judgement and privacy blur.
- Signed / QR-verifiable PDF report pipeline.
- Mobile, edge/live capture, fleet workflows and field validation.

These are separate roadmap work, not functional placeholders disguised as complete
features. The desktop slice is a runnable foundation for those next integrations.
