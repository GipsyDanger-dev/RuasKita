import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const qaDir = mkdtempSync(join(tmpdir(), "ruaskita-e2e-"));
const root = resolve(__dirname, "../..");
const python =
  process.platform === "win32"
    ? join(root, ".venv/Scripts/python.exe")
    : join(root, ".venv/bin/python");
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  retries: 0,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `"${python}" -m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8800`,
      cwd: root,
      url: "http://127.0.0.1:8800/health",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        RUASKITA_DB: join(qaDir, "test.sqlite3"),
        RUASKITA_DISABLE_MODEL: "1",
        RUASKITA_ORIGINS: "http://127.0.0.1:3100",
      },
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/system",
      reuseExistingServer: false,
      timeout: 120000,
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:8800" },
    },
  ],
});
