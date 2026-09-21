import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";
import path from "node:path";
const photo = path.resolve(__dirname, "../public/brand/road-evidence.jpg");

test("desktop reporting, persistence, repair, observations, map, reports, and themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Belum ada insiden" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "+ Laporkan kerusakan" }).click();
  await expect(
    page.getByRole("button", { name: "Simpan kandidat insiden" }),
  ).toBeDisabled();
  await page.getByLabel("Foto bukti", { exact: true }).setInputFiles(photo);
  await page
    .getByRole("button", { name: "Analisis dengan RuasVision" })
    .click();
  await expect(page.locator(".rk-main").getByRole("alert")).toContainText(
    "Checkpoint AI belum tersedia",
  );
  await page.getByLabel("Nama ruas jalan").fill("Jl. Kaliurang QA");
  await page.getByLabel("Latitude", { exact: true }).fill("-7.7621");
  await page.getByLabel("Longitude", { exact: true }).fill("110.3841");
  await page.getByLabel("Tingkat perhatian awal").selectOption("high");
  await page
    .getByLabel("Catatan kondisi")
    .fill("Bukti pengujian lokal. Bukan laporan lapangan.");
  await page.getByLabel("Nama pelapor").fill("Operator QA");
  await page.getByRole("button", { name: "Simpan kandidat insiden" }).click();
  await expect(page).toHaveURL(/\/incidents\/RK-/);
  const incidentPath = new URL(page.url()).pathname;
  await expect(
    page.getByRole("heading", { name: "Jl. Kaliurang QA" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Jl. Kaliurang QA" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Tindak lanjut" }).click();
  await page
    .getByLabel("Catatan tindakan")
    .fill("Foto telah ditinjau secara manual.");
  await page.getByRole("button", { name: "Simpan hasil tinjauan" }).click();
  await expect(page.locator(".rk-page-heading .rk-badge")).toHaveText(
    "Ditinjau",
  );
  await page.getByRole("tab", { name: "Tindak lanjut" }).click();
  await page.getByLabel("Penanggung jawab", { exact: true }).fill("Tim QA");
  await page
    .getByLabel("Catatan tindakan")
    .fill("Penugasan untuk simulasi lokal.");
  await page.getByRole("button", { name: "Tugaskan perbaikan" }).click();
  await expect(page.locator(".rk-page-heading .rk-badge")).toHaveText(
    "Ditugaskan",
  );
  await page.getByRole("tab", { name: "Tindak lanjut" }).click();
  await page
    .getByLabel("Catatan tindakan")
    .fill("Memulai proses perbaikan simulasi.");
  await page.getByRole("button", { name: "Mulai perbaikan" }).click();
  await expect(page.locator(".rk-page-heading .rk-badge")).toHaveText(
    "Diperbaiki",
  );
  await page.getByRole("tab", { name: "Tindak lanjut" }).click();
  await expect(
    page.getByRole("button", { name: "Kirim bukti perbaikan" }),
  ).toBeDisabled();
  await page
    .getByLabel("Foto setelah perbaikan", { exact: true })
    .setInputFiles(photo);
  await page
    .getByLabel("Catatan tindakan")
    .fill("Foto sesudah untuk simulasi alur.");
  await page.getByRole("button", { name: "Kirim bukti perbaikan" }).click();
  await expect(page.locator(".rk-page-heading .rk-badge")).toHaveText(
    "Periksa ulang",
  );
  await page.getByRole("tab", { name: "Tindak lanjut" }).click();
  await page
    .getByLabel("Saya telah meninjau bukti perbaikan", { exact: false })
    .check();
  await page
    .getByLabel("Catatan tindakan")
    .fill("Tinjauan lokal sudah selesai.");
  await page.getByRole("button", { name: "Konfirmasi selesai" }).click();
  await expect(page.locator(".rk-page-heading .rk-badge")).toHaveText(
    "Selesai",
  );
  await page.getByRole("tab", { name: "Tambah observasi" }).click();
  await page
    .getByLabel("Foto observasi baru", { exact: true })
    .setInputFiles(photo);
  await page.getByLabel("Nama kontributor").fill("Pengamat QA");
  await page
    .getByLabel("Catatan observasi")
    .fill("Observasi tambahan untuk riwayat.");
  await page.getByRole("button", { name: "Simpan observasi" }).click();
  await expect(page.locator(".rk-photo-caption")).toContainText("3 / 3");
  await page.getByRole("tab", { name: "Riwayat", exact: true }).click();
  await expect(page.locator(".rk-timeline article")).toHaveCount(7);
  await page.goto(`/map?id=${incidentPath.split("/").at(-1)}`);
  await expect(page.locator(".rk-map-detail")).toContainText(
    "Jl. Kaliurang QA",
  );
  await expect(page.locator(".rk-geo-marker")).toHaveCount(1);
  await page.goto("/ruasview");
  await expect(page.locator(".rk-evidence-image img")).toBeVisible();
  await page.getByLabel("Bandingkan awal / terbaru").check();
  await expect(page.locator(".rk-compare figure")).toHaveCount(2);
  await page.goto("/incidents");
  await page.getByLabel("Cari insiden").fill("tidak-ada");
  await expect(
    page.getByRole("heading", { name: "Tidak ada hasil" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filter" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto("/reports");
  await page.getByRole("button", { name: "+ Buat snapshot" }).click();
  await page.getByLabel("Judul laporan").fill("Snapshot pengujian desktop");
  await page.getByLabel("Tanggal awal").fill("2020-01-01");
  await page.getByLabel("Tanggal akhir").fill("2099-12-31");
  await page.getByRole("button", { name: "Simpan snapshot" }).click();
  await expect(page).toHaveURL(/\/reports\/REP-/);
  await page.getByRole("button", { name: "Periksa hash snapshot" }).click();
  await expect(page.getByRole("status")).toContainText("Hash snapshot cocok");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.json$/);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".rk-sidebar")).not.toBeVisible();
  await page.pdf({ path: "test-results/report.pdf", format: "A4" });
  await page.emulateMedia({ media: "screen" });
  for (const route of [
    "dashboard",
    "roads",
    "repairs",
    "analytics",
    "contributors",
    "system",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator(".rk-page-heading h1")).toBeVisible();
  }
  await page.getByRole("button", { name: "Gunakan tema gelap" }).click();
  await page.goto("/incidents");
  await expect(page.locator(".rk-app")).toHaveClass(/rk-dark/);
  await page.screenshot({
    path: "test-results/incidents-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Gunakan tema terang" }).click();
  await page.screenshot({
    path: "test-results/incidents-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "dashboard",
    "incidents/new",
    "map",
    "repairs",
    "reports",
    "analytics",
    "ruasview",
    "system",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator(".rk-page-heading h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `overflow on ${route}`,
    ).toBeTruthy();
  }
  await page.screenshot({
    path: "test-results/system-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("offline API offers retry and never displays fabricated data", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:8800/v1/incidents", (route) =>
    route.abort(),
  );
  await page.goto("/incidents");
  await expect(page.locator(".rk-main").getByRole("alert")).toContainText("Data belum bisa dimuat");
  await page.unroute("http://127.0.0.1:8800/v1/incidents");
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.locator(".rk-page-heading h1")).toBeVisible();
});

test("live camera explains a denied permission", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/incidents/new");
  await page.getByRole("button", { name: "Buka live camera / video" }).click();
  await page.getByRole("button", { name: "Mulai kamera" }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "Akses kamera ditolak. Izinkan kamera lalu coba lagi.",
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "File video" }).click();
  await page.getByLabel("Pilih video jalan").setInputFiles(photo);
  await expect(page.locator(".rk-main").getByRole("alert")).toContainText(
    "File video tidak dikenali",
  );
});

test("live camera samples a frame and renders the AI overlay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 360,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
      configurable: true,
      get: () => 4,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "play", {
      configurable: true,
      value: async () => undefined,
    });
    Object.defineProperty(CanvasRenderingContext2D.prototype, "drawImage", {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback) =>
        callback(new Blob(["frame"], { type: "image/jpeg" })),
    });
  });
  await page.route(
    "http://127.0.0.1:8800/v1/inference/image*",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          engine: "RuasVision v0.3",
          model_version: "RuasVision v0.3",
          generated_at: new Date().toISOString(),
          confidence_threshold: 0.5,
          image_shape: { width: 640, height: 360 },
          potholes: [
            {
              confidence: 0.82,
              polygon_xy: [
                [10, 10],
                [80, 10],
                [80, 70],
                [10, 70],
              ],
            },
          ],
        }),
      }),
  );
  await page.goto("/incidents/new");
  await page.getByRole("button", { name: "Buka live camera / video" }).click();
  await page.getByRole("button", { name: "Mulai kamera" }).click();
  await expect(
    page.locator(".rk-live-status").getByText(/Frame terakhir: 1 pothole/),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("img", { name: "1 area terdeteksi AI pada frame terakhir" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hentikan scan" }).click();
  await page.getByRole("tab", { name: "File video" }).click();
  await page.getByLabel("Pilih video jalan").setInputFiles({
    name: "road.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("test-video"),
  });
  await page.getByRole("button", { name: "Putar & scan video" }).click();
  await expect(
    page.locator(".rk-live-status").getByText(/Frame terakhir: 1 pothole/),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Hentikan scan" }).click();
});
