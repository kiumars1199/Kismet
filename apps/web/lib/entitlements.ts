// Tier table (docs/01-product.md § Tiers, docs/08-auth-billing.md § Entitlements) as data.
// Server routes enforce; the UI mirrors with <UpgradeGate>. Infinity = unlimited.
import { DEMO_MODE } from "@/lib/repo";

export type Tier = "free" | "pro" | "premium";

export type Feature =
  | "live_data" | "exact_edge" | "all_filters" | "full_execution" | "journal" | "csv_export"
  | "dashboards" | "alerts" | "push" | "webhooks" | "extension";

export type QuotaKey = "presets" | "dashboards" | "watchlist" | "alert_rules" | "flags_revealed" | "rows";

const FEATURES: Record<Tier, readonly Feature[]> = {
  free: [],
  pro: ["live_data", "exact_edge", "all_filters", "full_execution", "journal", "csv_export",
    "dashboards", "alerts", "push"],
  premium: ["live_data", "exact_edge", "all_filters", "full_execution", "journal", "csv_export",
    "dashboards", "alerts", "push", "webhooks", "extension"],
};

const QUOTAS: Record<Tier, Record<QuotaKey, number>> = {
  free: { presets: 1, dashboards: 0, watchlist: 10, alert_rules: 0, flags_revealed: 3, rows: 25 },
  pro: { presets: 25, dashboards: 3, watchlist: Infinity, alert_rules: 20, flags_revealed: Infinity, rows: Infinity },
  premium: { presets: Infinity, dashboards: Infinity, watchlist: Infinity, alert_rules: 100, flags_revealed: Infinity, rows: Infinity },
};

/** Free data is 15 minutes behind (docs/01). */
export const DELAY_MIN: Record<Tier, number> = { free: 15, pro: 0, premium: 0 };

export const can = (tier: Tier, feature: Feature): boolean => FEATURES[tier].includes(feature);
export const quota = (tier: Tier, key: QuotaKey): number => QUOTAS[tier][key];

/** Client tier. Demo mode has no auth or billing, so everyone is premium. */
export function useEntitlements() {
  // ponytail: real tier comes from /api/me once auth exists (docs/08)
  const tier: Tier = DEMO_MODE ? "premium" : "free";
  return {
    tier,
    can: (f: Feature) => can(tier, f),
    quota: (k: QuotaKey) => quota(tier, k),
  };
}
