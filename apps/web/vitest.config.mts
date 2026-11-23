import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": import.meta.dirname, "server-only": `${import.meta.dirname}/test/server-only.ts` } },
  test: {
    environment: "node",
    // PGlite suites replay every migration in beforeAll: ~3 s idle, over the 10 s default on a loaded 4-core box.
    hookTimeout: 60_000,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    env: { DATA_DIR: "test/fixtures", DATA_SOURCE: "local", DATA_CLOCK: "scan" },
  },
});
