import type { NextConfig } from "next";
import { DEMO_MODE } from "./lib/config";

const e2eMock = process.env.E2E_MOCK === "1" && process.env.NODE_ENV !== "production";

const config: NextConfig = {
  reactStrictMode: true,
  // T-70: Best bets moved from /flags to /. Old links, saved views and shares keep working (query is kept).
  redirects: async () => [{ source: "/flags", destination: "/", permanent: true }],
  // One switch: the browser's demo flag is the server's (fail-safe rule in lib/config.ts), never set on its own.
  env: { NEXT_PUBLIC_DEMO_MODE: String(DEMO_MODE) },
  // e2e only: the Stripe SDK can't take a base path, so its /v1 calls are routed to the in-app mock.
  ...(e2eMock ? { rewrites: async () => [{ source: "/v1/:path*", destination: "/e2e-mock/stripe/v1/:path*" }] } : {}),
};

export default config;
