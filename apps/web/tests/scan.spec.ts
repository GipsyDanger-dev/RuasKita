import { test, expect, type Page } from "@playwright/test";

async function camera(page: Page, accuracy = 12) {
  await page.addInitScript(({ accuracy }) => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }),
    } });
    const timers = new Map<number, ReturnType<typeof setInterval>>();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition: (callback: PositionCallback) => {
        const update = () => callback({ coords: { latitude: -7.7956, longitude: 110.3695, accuracy }, timestamp: Date.now() } as GeolocationPosition);
        update(); timers.set(1, setInterval(update, 1000)); return 1;
      },
      clearWatch: (id: number) => clearInterval(timers.get(id)),
    } });
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", { configurable: true, set: () => {} });
    for (const [key, value] of Object.entries({ videoWidth: 640, videoHeight: 360, readyState: 4 })) {
      Object.defineProperty(HTMLVideoElement.prototype, key, { configurable: true, get: () => value });
    }
    Object.defineProperty(HTMLVideoElement.prototype, "play", { configurable: true, value: async () => undefined });
    Object.defineProperty(CanvasRenderingContext2D.prototype, "drawImage", { configurable: true, value: () => undefined });
  }, { accuracy });
}

async function start(page: Page) {
  await page.goto("/scan");
  await page.getByLabel("Nama ruas atau rute").fill("Jl. Uji live scan");
  await page.getByLabel("Nama pelapor", { exact: true }).fill("Penguji browser");
  await page.getByRole("button", { name: "Siapkan live scan", exact: true }).click();
  await page.getByRole("button", { name: "Buka live scan", exact: true }).click();
  await page.getByRole("button", { name: "Mulai kamera", exact: true }).click();
}

test("automatic camera sends synchronized GPS and server-confirmed receipts, then stops", async ({ page, request }) => {
  await camera(page);
  let frameCount = 0;
  let sessionId = "";
  let firstPayload = "";
  await page.route("**/v1/scans/*/frames", async (route) => {
    const payload = route.request().postDataBuffer()?.toString() ?? "";
    const match = payload.match(/\{"sequence":\d+,"captured_at"[^\r\n]+/);
    expect(match).toBeTruthy();
    const meta = JSON.parse(match![0]);
    expect(meta.latitude).toBe(-7.7956);
    expect(meta.accuracy_m).toBe(12);
    expect(Date.parse(meta.captured_at) - Date.parse(meta.gps_at)).toBeLessThan(5000);
    sessionId = route.request().url().split("/").at(-2)!;
    frameCount++;
    if (frameCount === 1) { firstPayload = match![0]; await route.abort(); return; }
    if (frameCount === 2) expect(match![0]).toBe(firstPayload);
    await route.fulfill({ json: {
      point: { ...meta, state: "detected", incident_id: null }, frame_count: meta.sequence, incident_count: 0, incident_id: null,
      analysis: { engine: "RuasVision v0.3", model_version: "RuasVision v0.3", image_shape: { width: 640, height: 360 },
        potholes: [{ confidence: .8, polygon_xy: [[5, 5], [30, 5], [30, 30]] }], confidence_threshold: .5 },
    } });
  });
  await start(page);
  await expect(page.getByText("1 frame tersimpan. 0 kandidat area dilaporkan.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hentikan scan" }).click();
  await expect.poll(async () => (await request.get(`http://127.0.0.1:8800/v1/scans/${sessionId}`)).json().then(s => s.status)).toBe("stopped");
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Buka live scan" })).toBeFocused();
  await page.getByRole("button", { name: "Akhiri dan ganti rute" }).click();
  await expect(page.getByLabel("Nama ruas atau rute")).toBeVisible();
});

test("inaccurate GPS blocks uploads and the page reflows in both themes", async ({ page }) => {
  await camera(page, 90);
  let uploads = 0;
  page.on("request", request => { if (request.url().endsWith("/frames")) uploads++; });
  await start(page);
  await expect(page.getByText("Belum disimpan. Menunggu GPS terbaru dengan akurasi ±25 m atau lebih baik.")).toBeVisible();
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole("button", { name: "Gunakan tema gelap" }).click();
    }
    for (const width of [375, 844, 1440]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      await page.screenshot({ path: `test-results/scan-${theme}-${width}.png`, fullPage: true });
    }
  }
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Hentikan scan" }).click();
});
