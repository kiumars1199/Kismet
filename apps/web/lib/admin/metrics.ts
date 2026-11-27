// F15: /admin "Last 30 days". Pure: turns admin_metrics() (supabase/migrations/20261122000300_admin_metrics.sql) into
// table rows and totals. Money is cents until the last step, then "$1,234.56". Days before the revenue ledger began
// show "—" (unknown), never "$0.00".
export interface RawDay {
  day: string; signups: number; trials: number; payments: number; revenue_cents: number | null;
  churned: number; invites_sent: number; invites_verified: number;
}
export interface RawMetrics { days: RawDay[]; revenue_since: string | null; paying: { pro: number; premium: number }; mrr_cents: number }

export const dollars = (cents: number): string =>
  `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Monthly list price in dollars (config/site.json) to whole cents, without float drift: 11.99 -> 1199. */
export const toCents = (usd: number): number => Math.round(usd * 100);

export interface MetricRow extends Omit<RawDay, "revenue_cents"> { label: string; revenue: string }
export interface Summary {
  rows: MetricRow[];                       // newest first
  totals: { signups: number; trials: number; payments: number; churned: number; invites_sent: number; invites_verified: number; revenue_cents: number; revenue: string };
  payingTotal: number; mrr: string;
  revenueNote: string | null;              // "Revenue is recorded from Nov 19, 2026" when part of the window predates the ledger
}

const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const long = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function summarize(raw: RawMetrics): Summary {
  const days = [...raw.days].sort((a, b) => a.day.localeCompare(b.day));
  const known = days.filter((d) => d.revenue_cents !== null);
  const revenue_cents = sum(known.map((d) => d.revenue_cents as number));
  const partial = days.length > 0 && known.length < days.length;
  return {
    rows: days.map((d) => ({ ...d, label: label(d.day), revenue: d.revenue_cents === null ? "—" : dollars(d.revenue_cents) })).reverse(),
    totals: {
      signups: sum(days.map((d) => d.signups)), trials: sum(days.map((d) => d.trials)), payments: sum(days.map((d) => d.payments)),
      churned: sum(days.map((d) => d.churned)), invites_sent: sum(days.map((d) => d.invites_sent)), invites_verified: sum(days.map((d) => d.invites_verified)),
      revenue_cents, revenue: known.length ? dollars(revenue_cents) : "—",
    },
    payingTotal: raw.paying.pro + raw.paying.premium,
    mrr: dollars(raw.mrr_cents),
    revenueNote: raw.revenue_since && partial ? `Revenue is recorded from ${long(raw.revenue_since)}; earlier days show a dash.`
      : !raw.revenue_since && days.length ? "Revenue is recorded from the first paid invoice after this update; until then days show a dash." : null,
  };
}

/** F15: admin_mrr() (20261127000000_subscription_interval.sql). */
export interface RawMrr { mrr_cents: number; paying: { pro: number; premium: number }; yearly: number; unknown_interval: number }
export interface Mrr { value: string; sub: string; title: string }
export const MRR_TITLE_ESTIMATE = "Paying subscribers × monthly list price. Annual plans aren't separated until the billing-interval migration is applied; Stripe has the exact figure.";

/** One MRR for both blocks on /admin. With admin_mrr: yearly plans at their yearly price / 12, and the number of
 *  subscriptions whose plan length isn't recorded yet (counted monthly until their next Stripe event). Without it
 *  (migration not applied): the old estimate, said to be one. */
export function mrrView(raw: RawMrr | null, estimateCents: number): Mrr {
  if (!raw) return { value: dollars(estimateCents), sub: "at monthly list price", title: MRR_TITLE_ESTIMATE };
  const parts = [raw.yearly ? `${raw.yearly} yearly at price ÷ 12` : "monthly list prices"];
  if (raw.unknown_interval) parts.push(`${raw.unknown_interval} plan length not recorded yet, counted monthly`);
  return {
    value: dollars(raw.mrr_cents), sub: parts.join(" · "),
    title: "Paying subscribers at list price: monthly plans at the monthly price, yearly plans at the yearly price ÷ 12. Discounts aren't counted; Stripe has the exact figure.",
  };
}
