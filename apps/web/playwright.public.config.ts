import { defineConfig } from "@playwright/test";

// Run against the local preview. API writes are intercepted by the suite.
export default defineConfig({
  testDir: "./tests",
  testMatch: "public-design.spec.ts",
  outputDir: ".runtime/public-test-results",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.PUBLIC_PREVIEW_URL ?? "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
});
