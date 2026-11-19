"use client";
// Tier cards with a monthly/annual toggle (docs/01 § Tiers). Prices come from config/site.json prices_usd (owner, Nov 18:
// Pro $11.99/mo or $99.99/yr, Premium $19.99/mo or $169.99/yr; 7-day trial on both). In demo mode every button opens Best bets, since everything is already unlocked.
// Paid mode: Start trial → /api/stripe/checkout (sign in first); "Coming soon" until Stripe is configured.
import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/me";
import { track } from "@/lib/telemetry";
import { behindWords } from "@/lib/format";
import { SITE } from "@/lib/site";

export const PLANS = [
  { id: "free", name: "Free", monthly: 0, yearly: 0, line: "See how it works.",
    points: ["All open markets, {delay}, top 25 rows", "Estimated return shown as a range", "3 best bets a day", "Topic, sport and price filters", "1 saved view · 10 bets in My list", "Results and win-chance charts"] },
  { id: "pro", name: "Pro", monthly: SITE.prices.pro_monthly, yearly: SITE.prices.pro_yearly, line: "For people who bet every week.",
    points: ["Live prices, every market, no row limit", "Exact estimated return on every bet", "Every best bet, every filter", "Full price check: order book, stake table, how much you can bet", "Alerts by email and browser, 20 rules", "My bets with profit and closing-price tracking", "25 saved views · 3 dashboards · CSV export"] },
  { id: "premium", name: "Premium", monthly: SITE.prices.premium_monthly, yearly: SITE.prices.premium_yearly, line: "Everything, plus the browser extension.",
    points: ["Everything in Pro", "Chrome extension: estimated return right on Polymarket", "Telegram and Discord alerts, 100 rules", "Unlimited saved views and dashboards"] },
] as const;

const usd = (x: number) => `$${Number.isInteger(x) ? x : x.toFixed(2)}`;
/** The yearly saving shown on the toggle: the smallest across paid plans, in whole percent (never overstated). */
const SAVE_PCT = Math.min(...PLANS.filter((p) => p.monthly > 0).map((p) => Math.floor((1 - p.yearly / (12 * p.monthly)) * 100)));

/** `delay`: the Free plan delay in minutes, from site settings (free_delay_min). */
export function Plans({ demo, delay }: { demo: boolean; delay: number }) {
  const [annual, setAnnual] = useState(false);
  const me = useMe();
  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Billing period" className="flex w-fit gap-1 rounded-full border border-border bg-input p-1 text-sm">
        {[false, true].map((a) => (
          <button key={String(a)} type="button" role="radio" aria-checked={annual === a} onClick={() => setAnnual(a)}
            className={`min-h-11 rounded-full px-4 ${annual === a ? "bg-accent-bg text-accent-soft" : "text-soft hover:text-text"}`}>
            {a ? <>Yearly <span className="text-accent-softer">· save {SAVE_PCT}%</span></> : "Monthly"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const featured = p.id === "pro";
          const perMonth = annual ? p.yearly / 12 : p.monthly;
          return (
            <section key={p.id} aria-labelledby={`plan-${p.id}`}
              className={`flex flex-col gap-4 rounded-card border p-5 md:p-6 ${featured ? "border-accent-border bg-accent-bg" : "border-border bg-surface"}`}>
              <div>
                <h2 id={`plan-${p.id}`} className="text-lg font-semibold">{p.name}</h2>
                <p className={`text-sm ${featured ? "text-accent-softer" : "text-muted"}`}>{p.line}</p>
              </div>
              <p className="flex items-baseline gap-1.5">
                <span className="font-heading text-[36px] font-bold leading-none tracking-[-0.02em]" data-testid={`price-${p.id}`}>{usd(Math.round(perMonth * 100) / 100)}</span>
                <span className={`text-sm ${featured ? "text-accent-softer" : "text-muted"}`}>/ month</span>
              </p>
              <p className={`-mt-2 min-h-5 text-xs ${featured ? "text-accent-softer" : "text-muted"}`}>
                {p.monthly === 0 ? "Free forever" : annual ? `${usd(p.yearly)} billed yearly` : "7-day free trial"}
              </p>
              <ul className={`flex flex-1 flex-col gap-2 text-sm ${featured ? "text-accent-soft" : "text-soft"}`}>
                {p.points.map((x) => (
                  <li key={x} className="flex gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" className="mt-0.5 shrink-0" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    {x.replace("{delay}", behindWords(delay))}
                  </li>
                ))}
              </ul>
              <PlanButton id={p.id} annual={annual} demo={demo} me={me} featured={featured} />
            </section>
          );
        })}
      </div>
      {demo && <p className="text-xs text-muted">Demo: every feature is unlocked. No account or card needed.</p>}
    </div>
  );
}

function PlanButton({ id, annual, demo, me, featured }: { id: string; annual: boolean; demo: boolean; me: ReturnType<typeof useMe>; featured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cls = `flex min-h-11 items-center justify-center rounded-input px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${featured ? "bg-accent text-on-accent hover:bg-accent-hover" : "border border-border bg-muted-bg hover:border-accent-border"}`;
  if (id === "free") return <Link href={me?.auth && !me.user ? "/login?next=/" : "/"} className={cls}>Start free</Link>;
  if (demo || me?.demo) return <Link href="/" className={cls}>Start trial</Link>;
  if (!me?.billing) return <button type="button" disabled className={cls}>Coming soon</button>;
  if (!me.user) return <Link href="/login?next=/pricing" className={cls}>Start trial</Link>;
  if (me.tier === id) return <Link href="/account" className={cls}>Your plan</Link>;

  async function start() {
    setBusy(true);
    setError("");
    if (me!.tier === "free") track("checkout_started");
    // Already paying: plan changes go through the Stripe portal, never a second subscription.
    const res = await (me!.tier === "free"
      ? fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: `${id}_${annual ? "yearly" : "monthly"}` }),
      })
      : fetch("/api/stripe/portal", { method: "POST" })).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok && body?.url) return window.location.assign(body.url);
    setBusy(false);
    setError(body?.error ?? "Couldn't start checkout. Try again.");
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" className={cls} disabled={busy} onClick={start} data-testid={`checkout-${id}`}>
        {busy ? "Opening checkout…" : me.tier === "free" ? "Start trial" : `Switch to ${id === "pro" ? "Pro" : "Premium"}`}
      </button>
      {error && <p role="alert" className="text-xs text-warning">{error}</p>}
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="divide-y divide-border rounded-card border border-border bg-surface">
      {items.map(({ q, a }) => (
        <details key={q} className="group px-4 md:px-5">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
            {q}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted group-open:rotate-45" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </summary>
          <div className="max-w-2xl pb-4 text-sm leading-relaxed text-soft">{a}</div>
        </details>
      ))}
    </div>
  );
}
