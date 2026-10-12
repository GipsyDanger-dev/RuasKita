import { test, expect } from "@playwright/test";
import path from "node:path";

const report = {
  id: "RK-DESIGN-TEST", road: "Jalan uji antarmuka", latitude: -7.7956, longitude: 110.3695,
  severity: "medium", status: "candidate", assignee: "", notes: "Data khusus pengujian tampilan, bukan laporan masyarakat.",
  contributor: "Pengujian UI", created_at: "2026-10-12T07:00:00Z", updated_at: "2026-10-12T07:00:00Z", revision: 1,
  observations: [{ evidence_id: "ui-test", recorded_at: "2026-10-12T07:00:00Z", kind: "report", notes: "Foto pengujian.", analysis: null }], history: [],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/v1/**", async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.fulfill({ status: 500, json: { detail: "Unexpected write blocked by UI test" } });
    if (url.pathname === "/v1/incidents") return route.fulfill({ json: [report] });
    if (url.pathname === `/v1/incidents/${report.id}`) return route.fulfill({ json: report });
    if (url.pathname === "/v1/scans/coverage") return route.fulfill({ json: [] });
    if (url.pathname.startsWith("/v1/evidence/")) return route.fulfill({ path: path.resolve(__dirname, "../public/brand/road-evidence.jpg"), contentType: "image/jpeg" });
    await route.abort();
  });
});

for (const width of [375, 768, 1024, 1440]) {
  for (const theme of ["light", "dark"]) {
    test(`public pages fit ${width}px in ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem("ruas-theme", value), theme);
      for (const route of ["/", "/map", "/incidents", "/incidents/new", `/incidents/${report.id}`, "/scan"]) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator(".rk-public-header")).toBeVisible();
        await expect(page.locator(".rk-sidebar")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (theme === "dark") await expect(page.locator(".rk-public-root")).toHaveClass(/rk-dark/);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("home search, map selection, report detail and public navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Mau lihat jalan mana?").fill("Jalan uji");
  await page.getByRole("button", { name: "Cari jalan di peta" }).click();
  await expect(page).toHaveURL(/map\?road=Jalan\+uji/);
  await expect(page.getByPlaceholder("Nama jalan…")).toHaveValue("Jalan uji");
  await page.locator(".rk-map-results button").click();
  await page.locator(".rk-map-detail").getByRole("link", { name: "Lihat laporan" }).click();
  await expect(page.getByRole("heading", { name: report.road })).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await page.getByRole("link", { name: "Lihat di peta", exact: false }).click();
  await expect(page.locator(".rk-map-detail")).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Laporan", exact: true }).click();
  await page.getByPlaceholder("Cari nama jalan…").fill("not-a-road");
  await expect(page.getByRole("heading", { name: "Belum ada laporan di sini" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filter" }).click();
  await expect(page.locator(".citizen-report-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Gunakan tema gelap" }).click();
  await page.reload();
  await expect(page.locator(".rk-public-root")).toHaveClass(/rk-dark/);
});

test("photo form validates location and submits without writing to the real database", async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/v1/evidence", route => route.fulfill({ json: { id: "ui-test" } }));
  await page.route("**/v1/incidents", route => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: report });
    }
    return route.fulfill({ json: [report] });
  });
  await page.goto("/incidents/new");
  await expect(page.getByRole("button", { name: "Kirim laporan" })).toBeDisabled();
  await page.getByLabel("Foto bukti", { exact: true }).setInputFiles(path.resolve(__dirname, "../public/brand/road-evidence.jpg"));
  await page.getByLabel("Nama ruas jalan").fill(report.road);
  await page.getByLabel("Catatan kondisi").fill(report.notes);
  await page.getByLabel("Nama pelapor").fill("Pengujian UI");
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  await expect(page.locator(".rk-error[role=alert]")).toContainText("Tentukan lokasi jalan");
  await page.getByText("Isi koordinat secara manual", { exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("-7.7956");
  await page.getByLabel("Longitude", { exact: true }).fill("110.3695");
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  await expect(page).toHaveURL(`/incidents/${report.id}`);
  expect(submitted).toMatchObject({ latitude: -7.7956, longitude: 110.3695, evidence_id: "ui-test", road: report.road });
});

test("live scan setup, camera panel and keyboard skip link", async ({ page }) => {
  await page.goto("/scan");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Lewati navigasi" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#public-main")).toBeFocused();
  await page.getByLabel("Nama ruas atau rute").fill("Rute pengujian UI");
  await page.getByLabel("Nama pelapor").fill("Pengujian UI");
  await page.getByRole("button", { name: "Siapkan live scan" }).click();
  await page.getByRole("button", { name: "Buka live scan" }).click();
  await expect(page.locator(".rk-live-panel")).toBeVisible();
  await page.locator(".rk-live-close").click();
  await expect(page.locator(".rk-live-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Akhiri dan ganti rute" }).click();
  await expect(page.getByRole("button", { name: "Siapkan live scan" })).toBeVisible();
});

test("GPS fills the selected location and map controls work", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -7.78, longitude: 110.37, accuracy: 8 });
  await page.goto("/incidents/new");
  await page.getByRole("button", { name: "Gunakan lokasi saya" }).click();
  await expect(page.getByText("Titik lokasi sudah dipilih.", { exact: false })).toBeVisible();
  await page.getByText("Isi koordinat secara manual", { exact: true }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("-7.780000");
  await expect(page.getByLabel("Longitude", { exact: true })).toHaveValue("110.370000");
  await page.locator(".maplibregl-ctrl-zoom-in").click();
  await page.locator(".maplibregl-ctrl-zoom-out").click();
});

test("public text contrast in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(value => localStorage.setItem("ruas-theme", value), theme);
    for (const route of ["/", "/incidents/new", `/incidents/${report.id}`, "/scan"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      const failures = await page.evaluate(() => {
        const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
        const luminance = (color: number[]) => color.slice(0, 3).reduce((sum, c, i) => {
          const n = c / 255;
          return sum + (n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
        }, 0);
        return [...document.querySelectorAll<HTMLElement>(".rk-public-root h1, .rk-public-root h2, .rk-public-root p, .rk-public-root label, .rk-public-root small, .rk-public-root a, .rk-public-root button")].flatMap(element => {
          if (!element.innerText.trim() || !element.getClientRects().length || element.closest(".rk-map-frame") || element.matches(":disabled") || element.classList.contains("rk-public-skip")) return [];
          const style = getComputedStyle(element);
          let parent: HTMLElement | null = element;
          let background = [255, 255, 255];
          while (parent) {
            const color = rgb(getComputedStyle(parent).backgroundColor);
            if (color.length === 3 || color[3] === 1) { background = color; break; }
            parent = parent.parentElement;
          }
          const a = luminance(rgb(style.color));
          const b = luminance(background);
          const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
          return ratio + .01 < (large ? 3 : 4.5) ? [{ text: element.innerText.slice(0, 60), ratio }] : [];
        });
      });
      expect(failures, `${theme} ${route}`).toEqual([]);
    }
  }
});

test("home has loading, error/retry and empty states", async ({ page }) => {
  let response: "wait" | "error" | "empty" = "wait";
  await page.route("**/v1/incidents", async route => {
    if (response === "wait") await new Promise(resolve => setTimeout(resolve, 900));
    if (response === "empty") return route.fulfill({ json: [] });
    return route.fulfill({ status: 503, json: { detail: "Test offline" } });
  });
  await page.goto("/");
  await expect(page.getByText("Mengambil laporan terbaru…", { exact: true })).toBeVisible();
  response = "error";
  await expect(page.locator(".citizen-data-state[role=alert]")).toBeVisible();
  response = "empty";
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("heading", { name: "Belum ada laporan di sini" })).toBeVisible();
});
