import { defineConfig } from "@playwright/test";

// Smoke flows S1–S6 live in e2e/ (Lane G). Runs against the fixture data.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: { DATA_DIR: "test/fixtures", DATA_SOURCE: "local", DEMO_MODE: "true" },
  },
});
