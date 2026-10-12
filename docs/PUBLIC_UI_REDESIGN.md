# RuasKita public UI redesign

## Scope and direction

Audience: members of the public reporting and reading road conditions, not an institution's operators.
Screens: home, road map, report list, report creation, report detail, and live scan.
Existing administrative routes are not linked from the public navigation; their tools are not redesigned in this change.

Reading: a citizen-facing web application with a calm, modern consumer interface.
Design dials: ENERGY 2 / RHYTHM 2 / MOTION 1.

### Decisions

- Canvas `#f8faf8`, surface `#ffffff`, text `#203c32`, secondary text `#647069`, pine `#244b38`, action highlight `#d9edaf`. The green family follows the user's consumer-app reference; the highlight distinguishes reporting from browsing.
- Geist remains the shared face: compact letterforms keep Indonesian navigation and road names readable across narrow layouts, without adding a second decorative font. Headings use medium weight and a 34–50px scale rather than oversized marketing type.
- The home's main composition joins a working map to a contribution panel. The map is the product itself, not a decorative image or fabricated preview.
- Search goes straight to a filtered map. Latest reports come from the API, sorted by update time, with photo-led rows rather than an administrative table.
- Rounding has levels: 20–22px map/form regions, 10–12px controls/media, 6px status labels. Rounded navigation identifies the selected destination.
- Spacing separates tasks: generous separation between browsing and contributing; tighter spacing inside each task. Mobile stacks content in reading order.
- Supplied logos are reused. No avatars, testimonials, invented counts, generated brand imagery, or fake reports were added.
- Muted status colors are accompanied by text. Empty/loading/error states remain explicit.
- Motion is limited to interaction feedback and existing map navigation. Reduced-motion preference is respected; no looping blurred headings.
- Manual coordinates are available in a disclosure rather than dominating the form. GPS and map picking remain available. Missing location is validated before submission.
- Portrait evidence is contained in a bounded viewer, preserving its full content and alignment with segmentation overlays.

The design skill's initial automated recommendation (dark hero and testimonials) did not fit this task and was rejected. Its narrower public-service result supported direct navigation and accessible minimalism; the user's green consumer-app direction takes precedence over its suggested blue palette.

## Verification, 12 October 2026

Local preview: `http://localhost:3000`. API remains at `http://127.0.0.1:8000`.

From `apps/web`:

```text
npm run test:public
npm run review:public
npx tsc --noEmit
npm run lint
```

`test:public` requires the preview server. API responses and writes are intercepted; test reports are never written into the user's database. `review:public` reads the actual local API and saves screenshots under the ignored `.runtime/` folder.

### Browser checks

- 14 Playwright tests passed. Six public screens checked at 375, 768, 1024 and 1440px, in both themes: no document overflow, no runtime page errors, no administrative sidebar.
- Home search submits its road name to the map; map filters preserve the query.
- Map result selection opens the report callout, its detail link opens the correct report, and the detail's map link reselects the report.
- Report search has an empty state; reset restores results. Theme selection survives a reload.
- Upload enables submission, missing location produces a validation message, manual coordinates and a mocked submission reach the report detail.
- Controlled browser GPS fills the coordinate fields. Map zoom controls are clickable.
- Live scan setup opens the camera panel, close dismisses it, and ending a route restores setup. The keyboard skip link focuses the main content.
- Home loading, API error, retry and empty states are exercised.
- Computed text contrast passes the tested public typography/controls in both themes. This is a targeted check, not a complete accessibility certification or audit of third-party map tiles.
- TypeScript passes. ESLint has no errors; four existing native-image warnings remain.

### Visual review and corrections

24 actual-data captures cover six screens at 1440 and 390px in light/dark mode. The reviewer inspected screenshots, not only element geometry.

Corrections from visual review:

- Shortened mobile headline to eliminate an orphan final word.
- Removed the nested search-input border.
- Replaced the exposed English native upload control with a keyboard-accessible Indonesian upload area.
- Matched upload/camera DOM order to their visual order.
- Reduced oversized portrait evidence while preserving overlays.
- Enlarged map zoom controls and marker hit areas.
- Fixed map framing after React Strict Mode remounts; saved markers previously could sit outside the initial viewport.

Local captures: `apps/web/.runtime/review-{screen}-{theme}-{width}.png`, screen indices 0 home, 1 map, 2 reports, 3 form, 4 scan, 5 detail. Capture JSON records viewport sizes, computed font, markers and runtime errors. External tiles may still be loading in an early capture; the reusable script waits for the loading message to clear, up to 15 seconds.

### Delivery gate

- Hard gate PASS for the tested UI scope: working destinations, both themes, keyboard skip/focus, real data, explicit states, responsive checks and controlled form tests.
- Purpose gate PASS: palette, type, containers, navigation states and limited motion have the reasons recorded above; no decorative statistics or unrequested assets.
- Liveliness PASS: map-led home, photo-led reports, one contribution accent and consistent public identity across the six screens.
- Craftsmanship PASS for this change: screenshots reviewed and corrected, runtime and TypeScript checks completed, user data preserved.

Limits: testing used desktop Chromium and emulated viewport sizes. Physical phone camera/GPS, field model accuracy, public deployment security and the legacy administrative test suite are not certified by these UI tests. Existing model and database behavior were preserved; the submission test uses an intercepted response, not a new end-to-end backend certification. Aesthetic acceptance remains the user's decision.
