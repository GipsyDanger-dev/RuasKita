# Goal — functional desktop workspace

Date: 2026-09-21. Scope: local desktop vertical slice, before mobile and field validation.

## Delivered

- [x] Preserve approved homepage composition; connect it to workspace routes.
- [x] Shared quiet visual hierarchy, navigation, light/dark preference.
- [x] Overview, map, roads, incidents, repairs, RuasView, analytics, reports,
  contributors and system pages backed by persisted local records.
- [x] Upload → optional real AI segmentation → coordinate selection → candidate
  incident → detail and map.
- [x] Guarded repair transitions, responsible team, new repair evidence,
  local recheck, resolve and reopen.
- [x] Observations/history linked to one incident instead of separate reports.
- [x] Immutable report snapshots, JSON export, snapshot hash verification and
  browser print-to-PDF labelled as internal draft.
- [x] Empty, loading, failure/retry and no-results states; no seeded production data.
- [x] API tests and browser E2E in separate temporary databases.

## Verification evidence

- 33 API contract tests passed (isolated SQLite, model disabled), including the
  PostgreSQL/PostGIS migration contract checks.
- 5 end-to-end browser tests passed, including the full local lifecycle,
  every module route, responsive overflow checks at 390px, theme persistence,
  snapshot export/print, and offline API retry.
- Actual frozen RuasVision model tested separately through the browser: uploaded
  road image returned 3 detections and rendered polygons; result saved into an
  incident and appeared as a coordinate-linked map marker. These are inference
  outputs, not manually verified ground truth or a new accuracy benchmark.
- Production build and TypeScript passed. ESLint has zero errors; four image
  optimization advisories remain (original home/workbench and local image viewers).
- Screenshots inspected for desktop light/dark, map, upload/AI overlay and mobile.
  Screenshot/PDF outputs are local test artifacts and intentionally not committed.

## Dashboard redesign follow-up

- Replaced the sparse overview with a geographic dashboard: linked incident counts,
  interactive map, repair completion and a prioritized incident list.
- Added an ink/lime visual direction, clearer typography and a normal-flow brand.
  Consolidated competing shell styles and restored light print styles in dark mode.
- Mobile navigation now opens in a modal drawer with keyboard focus cycling,
  Escape dismissal, focus return and desktop-resize dismissal.
- Counts open the corresponding active/severity/status filters. Empty records show
  no completion percentage; the progress measure is resolved incidents, not road health.
- Five browser E2E tests passed: the two original workflow/offline tests plus
  count/filter/refresh correctness, keyboard navigation and responsive checks with
  long road names at 320, 375, 768, 1024, 1100, 1280 and 1440px.
- Removed the development badge that covered navigation during local review.

## Integration sprint status

The first foundation slice is now in progress: incident provenance fields,
schema versioning, a storage adapter seam, an explainable duplicate-candidate
endpoint, contract documentation, and CI checks are present. Automatic merges,
road association, and production storage remain intentionally incomplete.

## Remaining integration sprint

1. Replace local-only access with Supabase Auth/RBAC and migrate persistence to
   PostgreSQL/PostGIS plus private cloud evidence storage.
2. Add road matching, deduplication and event-based updates on the existing domain
   workflow, then calibrate attention/road-health metrics.
3. Add official verified reporting, richer capture sequences and privacy processing.

Metric depth, mobile/edge capture and field validation remain separate roadmap
milestones. They are not marked achieved by having UI routes.

See [desktop workspace contract and limitations](DESKTOP_WORKSPACE.md).
