import { defineConfig } from "@playwright/test";

// Paid-mode flows (S7 upgrade, account delete): DEMO_MODE=false, with Supabase and Stripe served by the in-app
// mock (app/e2e-mock, on only with E2E_MOCK=1 outside production). Same port as the demo run; they run one after the other.
const PORT = Number(process.env.PW_PORT ?? 3100);
const ORIGIN = `http://localhost:${PORT}`;
export default defineConfig({
  testDir: "e2e-paid",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: ORIGIN },
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    env: {
      DATA_DIR: "test/fixtures", DATA_SOURCE: "local", DEMO_MODE: "false", NEXT_PUBLIC_DEMO_MODE: "false", E2E_MOCK: "1",
      NEXT_PUBLIC_SITE_URL: ORIGIN,
      NEXT_PUBLIC_SUPABASE_URL: `${ORIGIN}/e2e-mock/supabase`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon", SUPABASE_SERVICE_ROLE_KEY: "e2e-service",
      STRIPE_SECRET_KEY: "sk_test_e2e", STRIPE_WEBHOOK_SECRET: "whsec_e2e", STRIPE_API_BASE: ORIGIN,
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_m", STRIPE_PRICE_PRO_YEARLY: "price_pro_y",
      STRIPE_PRICE_PREMIUM_MONTHLY: "price_premium_m", STRIPE_PRICE_PREMIUM_YEARLY: "price_premium_y",
    },
  },
});
