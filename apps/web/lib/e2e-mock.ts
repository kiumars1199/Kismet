// The one gate for every e2e-only escape hatch (the /e2e-mock Supabase/Stripe stand-ins, the /v1 rewrite and middleware
// passthrough, the x-e2e-device header, STRIPE_API_BASE, the rate limiter being off). No imports: safe in middleware
// (edge), next.config and client-free server code.
//
// On: E2E_MOCK=1 in a dev/test process (as before), or in a PRODUCTION BUILD (`next build && next start`, which the paid
// e2e now runs: no on-demand compile, no dev overlay) only when the run says so a second time with E2E_PROD_BUILD=1.
// Never on Vercel, whatever the variables say: a real deployment sets neither flag, and if one were ever set by mistake
// VERCEL / VERCEL_ENV (set by the platform) still keep every mock closed.
export function e2eMockOn(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.E2E_MOCK !== "1" || env.VERCEL || env.VERCEL_ENV) return false;
  return env.NODE_ENV !== "production" || env.E2E_PROD_BUILD === "1";
}
