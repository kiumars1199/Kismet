// Browser start-up hook (Next 15.3+). Each tool loads only when its public key is set.
import { initAnalytics, sentryOptions } from "@/lib/telemetry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) void import("@sentry/nextjs").then((Sentry) => Sentry.init(sentryOptions(dsn)));
void initAnalytics();
