import { defineConfig } from "@playwright/test";

// Smoke flows S1–S6 live in e2e/. Runs against the fixture data on its own port (3100), so a real-data
// dev server on 3000 is never reused by mistake.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "pnpm exec next dev -p 3100",
    port: 3100,
    reuseExistingServer: false,
    env: { DATA_DIR: "test/fixtures", DATA_SOURCE: "local", DEMO_MODE: "true" },
  },
});
