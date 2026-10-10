# Live scan: camera, GPS, database, map

Implemented 2026-10-10 for a local, supervised phone preview. This is not field validation or a production multiuser release.

## Operator flow

Open `/scan`, enter the route and contributor, prepare the scan, open the camera,
then grant camera and location permission. Starting the camera explicitly starts
automatic reporting. Use a passenger or set up the mounted device before driving.
Keep the page visible. Hiding the page stops capture; start a new session to resume.

Each accepted sample stores GPS, capture/GPS timestamps, measured GPS accuracy,
model result and image sharpness in SQLite. The image is retained only for a newly
created candidate area. The operator does not need to press the manual report form.
`/map`, `/incidents`, and `/dashboard` poll persisted incidents every four seconds.
`/map` and `/scan` also fetch recent coverage. This is polling, not websocket realtime.

## Data contract and safeguards

- SQLite schema 3 adds `scan_sessions` and `scan_frames`, preserving existing data.
- `POST /v1/scans`: idempotent session creation with request UUID, route and contributor.
- `POST /v1/scans/{id}/frames`: multipart image + strict metadata JSON. The server
  computes inference itself; client-supplied detection results are rejected.
- Frame sequence plus content hash makes retries idempotent. Reusing the sequence
  with different data returns 409. A stopped session rejects new frames.
- `GET /v1/scans/{id}` returns the complete bounded session trail.
- `GET /v1/scans/coverage` returns up to 3,000 latest samples; `GET /v1/scans`
  returns the 50 latest sessions. `POST /v1/scans/{id}/stop` ends a session.
- GPS accuracy must be within 25 m, age within 5 s of capture; reject out-of-order
  frames, clock skew and implausible jumps. GPS is the device position, not an
  estimated pothole position. A route name is entered, not reverse-geocoded.
- Frame requests are serialized by the client, sampled at least 1.5 s after the
  previous response. Each session allows 3,600 samples. Capture scales to 1,280 px.
- Retry the same payload up to three attempts; after failure stop and show an error.
  This release does not provide a durable offline queue or background recording.
- File video remains manual preview only. It never borrows the viewer's current GPS.
- Manual evidence gets GPS only when a camera frame is selected, so ongoing location
  updates no longer overwrite a manually selected report pin.

## Detection policy, not a new accuracy benchmark

Frozen RuasVision v0.3 remains unchanged, confidence 0.50. The offline mask mAP50
is 0.664 and mask mAP50-95 is 0.345; image-level precision is not mask accuracy.

Two usable positive samples within 12 seconds and 20 meters create a candidate
area. Repeated samples in that zone reuse the candidate within the same session;
a brief missed detection can bridge up to 60 seconds. Other sessions' incidents
are not automatically merged. Multiple nearby physical potholes may share one
candidate area: counts are candidate zones, not a verified pothole census.

Laplacian variance below 40 marks a frame `uncertain`. This is an experimental
sharpness heuristic and must be calibrated with real phone clips. Temporal
confirmation can reduce transient detections but can also miss short-lived views.
Neither heuristic proves that model accuracy increased. No new training was run.

Coverage uses three explicit states: `detected`, `no_detection`, `uncertain`.
No detection does NOT mean healthy road. Connecting lines depict sampled device
movement, not measured road segments. Gaps over 20 seconds or 100 meters are not
connected. Attention defaults to provisional medium, not calibrated severity.
Metric depth, road matching and Road Health Score remain unavailable.

## Verification

API tests use isolated databases and mocked inference, testing persistence,
confirmation, blur, bad/stale GPS, ordering, retries and unavailable inference.
Browser tests mock camera/GPS and frame receipts, exercising setup, retry, GPS
gating, stop, keyboard and light/dark responsive states. They do not prove physical
phone camera compatibility or model accuracy.

Opt-in real-weight integration test (temporary database; no production records):

```powershell
$env:RUASKITA_REAL_SCAN_SMOKE='1'
.\.venv\Scripts\python.exe -m unittest services.api.tests.test_scan_model_smoke -v
```

The bundled road-evidence image produced 3 detections and 1 persisted candidate
area after two frames on 2026-10-10. This is a smoke test, not a labeled benchmark.

Verification on 2026-10-10: production build passed; 10 browser E2E tests passed;
TypeScript passed; lint had zero errors and four existing image optimization
warnings. Remote HTTPS preview returned 200 with credentials and 401 without;
authenticated writes from an unrelated Origin returned 403. An empty write from
the correct Origin reached API validation (422), without creating any data.
The HTTPS page exposed camera APIs in the browser and had no page errors.

Next accuracy work: collect consented, non-identifying phone clips with labels,
group splits by route/session, evaluate false candidates per km, missed potholes,
localization error, latency and the confirmation/blur policy. Compare frozen weights
before proposing retraining; the user monitors any training run.

## Temporary phone access

Build with `infra/windows/build-host.ps1`, then run `start-phone-preview.ps1`.
The script refuses occupied ports and launches hidden local API (8000), production
web (3000), a password gateway (3080), and Cloudflare Tunnel. Every listener binds
to 127.0.0.1. Runtime credentials, PID/start-time ownership and logs are under
`.runtime/` and ignored by Git. Open the HTTPS origin plus `/scan` from the phone.
Use the username/password in `.runtime/phone-access.json` in the browser prompt.

The gateway requires a random password for EVERY path, including images and API;
authenticated writes must have the exact allowed browser Origin. Only after that
check does it translate Origin for the loopback API. No public API port is opened.
This is shared preview access, not Supabase Auth/RBAC. Anyone with the password
can use the workspace. Images/GPS travel through Cloudflare; use non-identifying
test evidence. Face/plate blurring is not implemented. Do not share the password.

Stop only this managed preview with `infra/windows/stop-phone-preview.ps1`.
Stop before rebuilding; restart rotates the password and tunnel URL. The computer
must remain awake and online. No startup task, firewall or sleep changes are made.
Quick tunnels are temporary testing infrastructure, not a production deployment.

Reference: [Cloudflare Tunnel quick tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## UI direction and review

Use existing RuasKita tokens: page #f7f8fa, surface #ffffff, ink #172629,
muted #606c70, action #285846. Reuse Geist for continuity/readability.
Reading this as a road-survey tool for operators, in the existing restrained
RuasKita language: ENERGY 1 / RHYTHM 2 / MOTION 1. Camera is the focal point;
map sits alongside on desktop and follows below on phone. No new brand assets.
Retain existing accent only for actions; coverage colors have explicit text labels.
Spacing separates capture from review. No ornamental cards or animation.
