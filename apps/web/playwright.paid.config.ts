import { defineConfig, devices } from "@playwright/test";

// Paid-mode flows (S7 upgrade, account delete): DEMO_MODE=false, with Supabase and Stripe served by the in-app
// mock (app/e2e-mock, on only with E2E_MOCK=1 outside production). Same port as the demo run; they run one after the other.
const PORT = Number(process.env.PW_PORT ?? 3100);
const ORIGIN = `http://localhost:${PORT}`;
export default defineConfig({
  testDir: "e2e-paid",
  workers: 1,
  timeout: 120_000,   // a cold .next compiles every route on first hit
  use: { baseURL: ORIGIN },
  // docs/OVERHAUL.md §D: the iPhone spec runs in WebKit at 390×844 and 430×932; everything else in Chromium.
  // PW_CHROMIUM_PATH: use a preinstalled Chromium when the pinned Playwright's own build isn't downloaded.
  projects: [
    { name: "chromium", testIgnore: /overhaul-iphone/, use: { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined } } },
    { name: "iphone-390", testMatch: /overhaul-iphone/, use: { ...devices["iPhone 15"], viewport: { width: 390, height: 844 } } },
    { name: "iphone-430", testMatch: /overhaul-iphone/, use: { ...devices["iPhone 15 Pro Max"], viewport: { width: 430, height: 932 } } },
  ],
  webServer: {
    // A production build, not `next dev` (T-ci1): dev compiles each route on its first hit and dropped connections under load
    // ("[Error: aborted] ECONNRESET", then ERR_CONNECTION_RESET in random specs), and its overlay injects fonts that fake layout
    // shifts. The mocks stay closed in production unless E2E_MOCK=1 and E2E_PROD_BUILD=1 are both set off Vercel (lib/e2e-mock.ts);
    // the build runs with the same env because the /v1 rewrite and the NEXT_PUBLIC_ URLs are fixed at build time.
    command: `node e2e-paid/make-fixtures.mjs && pnpm exec next build && pnpm exec next start -p ${PORT}`,
    timeout: 600_000,   // the build is part of the web server's start
    port: PORT,
    reuseExistingServer: false,
    env: {
      DATA_DIR: "test-results/paid-fixtures", HISTORY_LIVE: "off", DATA_SOURCE: "local", DATA_CLOCK: "scan", DEMO_MODE: "false", NEXT_PUBLIC_DEMO_MODE: "false", E2E_MOCK: "1", E2E_PROD_BUILD: "1",
      UNSUBSCRIBE_SECRET: "e2e-only-".padEnd(40, "0"),   // a production build has no dev fallback key: share-link signatures and the lifecycle hook need one (lib/share/sig.ts)
      NEXT_PUBLIC_SITE_URL: ORIGIN, ADMIN_EMAILS: "admin-e2e@example.com",   // e2e admin (e2e-paid/admin.spec.ts), never the owners
      NEXT_PUBLIC_GOOGLE_AUTH: "1",   // as production: the Google button (and the 18+ box above it) is on, so every auth e2e sees the taller first view
      KALSHI_DATA_PERMISSION: "true",   // as production (owner decision, Nov 21): /kalshi and the Kalshi combo check are on
      NEXT_PUBLIC_SUPABASE_URL: `${ORIGIN}/e2e-mock/supabase`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon", SUPABASE_SERVICE_ROLE_KEY: "e2e-service",
      STRIPE_SECRET_KEY: "sk_test_e2e", STRIPE_WEBHOOK_SECRET: "whsec_e2e", STRIPE_API_BASE: ORIGIN,
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_m", STRIPE_PRICE_PRO_YEARLY: "price_pro_y",
      STRIPE_PRICE_PREMIUM_MONTHLY: "price_premium_m", STRIPE_PRICE_PREMIUM_YEARLY: "price_premium_y",
      // next dev restarts itself (dropping in-flight requests) once used heap passes 80% of the V8 limit, and its heap
      // grows ~350 MB/min for the whole run. Pin the limit so the restart point doesn't depend on the runner's RAM;
      // `pnpm e2e` also runs this suite in two shards, each with its own server, so neither gets near it.
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=8192"].filter(Boolean).join(" "),
    },
  },
});
