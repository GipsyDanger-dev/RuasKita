import { test, expect } from "@playwright/test";
import type { Incident } from "../src/lib/workspace";

const incidents: Incident[] = [
  {
    id: "RK-RESP-01",
    road: "Jalan Kaliurang dengan nama ruas yang sangat panjang untuk menguji keterbacaan di layar kecil",
    status: "candidate",
    severity: "high",
  },
  {
    id: "RK-RESP-02",
    road: "Jalan Gejayan",
    status: "assigned",
    severity: "medium",
  },
  {
    id: "RK-RESP-03",
    road: "Jalan Bantul",
    status: "verified",
    severity: "low",
  },
  {
    id: "RK-RESP-04",
    road: "Jalan Magelang",
    status: "resolved",
    severity: "high",
  },
].map((item, index) => ({
  ...item,
  status: item.status as Incident["status"],
  severity: item.severity as Incident["severity"],
  latitude: -7.7956 + index / 100,
  longitude: 110.3695 + index / 100,
  assignee: "",
  notes: "",
  contributor: "Test operator",
  revision: 1,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-02T00:00:00Z",
  observations: [],
  history: [],
}));

test("dashboard counts and links reflect actual incident states", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/v1/incidents", async (route) => {
    requests++;
    await route.fulfill({ json: incidents });
  });
  await page.goto("/dashboard");
  const stats = page.getByRole("region", { name: "Ringkasan insiden" });
  await expect(
    stats.getByRole("link", { name: /^Insiden aktif/ }).locator("strong"),
  ).toHaveText("3");
  await expect(
    stats.getByRole("link", { name: /^Perhatian tinggi/ }).locator("strong"),
  ).toHaveText("1");
  await expect(
    stats.getByRole("link", { name: /^Dalam penanganan/ }).locator("strong"),
  ).toHaveText("1");
  await expect(
    stats.getByRole("link", { name: /^Sudah selesai/ }).locator("strong"),
  ).toHaveText("1");
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "25");
  await expect(
    page
      .getByRole("region", { name: /^Perlu ditindaklanjuti/ })
      .getByRole("listitem"),
  ).toHaveCount(3);
  const before = requests;
  await page.getByRole("button", { name: "Perbarui data" }).click();
  await expect(stats).toBeVisible();
  expect(requests).toBeGreaterThan(before);
  await stats.getByRole("link", { name: /^Perhatian tinggi/ }).click();
  await expect(page.getByLabel("Hanya insiden aktif")).toBeChecked();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText(incidents[0].road);
  await page.getByRole("button", { name: "Reset filter" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
});

test("dashboard reflows with long road names and a keyboard accessible mobile menu", async ({
  page,
}) => {
  await page.route("**/v1/incidents", (route) =>
    route.fulfill({ json: incidents }),
  );
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1100, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `page overflow at ${width}`,
    ).toBeTruthy();
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    const action = await page
      .getByRole("link", { name: "+ Laporkan kerusakan", exact: true })
      .boundingBox();
    expect(
      title &&
        action &&
        (title.y + title.height <= action.y ||
          title.x + title.width <= action.x),
      `title overlaps action at ${width}`,
    ).toBeTruthy();
    for (const label of ["PANTAU & TINDAK LANJUTI", "Belum ada progres"]) {
      const match = page.getByText(label, { exact: true });
      if (await match.count()) await expect(match).toBeVisible();
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const menuButton = page.getByRole("button", { name: "Menu", exact: true });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog", { name: "Menu RuasKita" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link")).toHaveCount(10);
  for (let index = 0; index < 14; index++) {
    await page.keyboard.press("Tab");
    expect(
      await menu.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await menu.getByRole("link", { name: "Insiden", exact: true }).click();
  await expect(page).toHaveURL(/\/incidents$/);
  await expect(menu).not.toBeVisible();
  await menuButton.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(menu).not.toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navigasi workspace", exact: true }),
  ).toBeVisible();
});

test("empty dashboard never implies perfect road health or completed repairs", async ({
  page,
}) => {
  await page.route("**/v1/incidents", (route) => route.fulfill({ json: [] }));
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Belum ada insiden", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    "Belum ada data",
  );
  await expect(
    page.getByText("Belum ada progres", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gunakan tema gelap" }).click();
  await expect(page.locator(".rk-app")).toHaveClass(/rk-dark/);
  await expect(
    page.getByRole("link", { name: "+ Laporkan kerusakan", exact: true }),
  ).toBeVisible();
});
