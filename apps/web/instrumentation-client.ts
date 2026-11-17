// Browser start-up hook (Next 15.3+). Each tool loads only when its public key is set.
import { initBotId } from "botid/client/core";
import { initAnalytics, sentryOptions } from "@/lib/telemetry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) void import("@sentry/nextjs").then((Sentry) => Sentry.init(sentryOptions(dsn)));
void initAnalytics();

// Vercel BotID (docs/15): the browser half of checkBotId() in lib/abuse.ts. Same routes as the server checks.
// Only on Vercel (next.config sets the flag), where the challenge proxy exists.
if (process.env.NEXT_PUBLIC_BOTID === "1") {
  initBotId({
    protect: [
      { path: "/api/markets", method: "GET" },
      { path: "/api/markets/*", method: "GET" },
      { path: "/api/flags", method: "GET" },
      { path: "/api/events/*", method: "GET" },
      { path: "/api/suggest", method: "GET" },
      { path: "/api/book", method: "GET" },
      { path: "/api/auth/magic-link", method: "POST" },
      { path: "/api/stripe/checkout", method: "POST" },
    ],
  });
}
