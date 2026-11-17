"use client";
// Tier cards with a monthly/annual toggle (docs/01 § Tiers: Pro $19, Premium $29, annual = 2 months free,
// 7-day trial). In demo mode every button opens Best bets, since everything is already unlocked.
import Link from "next/link";
import { useState } from "react";

export const PLANS = [
  { id: "free", name: "Free", monthly: 0, line: "See how it works.",
    points: ["All open markets, 15 minutes behind, top 25 rows", "Expected return shown as a range", "3 best bets a day", "Topic, sport and price filters", "1 saved view · 10 bets in My list", "Results and win-chance charts"] },
  { id: "pro", name: "Pro", monthly: 19, line: "For people who bet every week.",
    points: ["Live prices, every market, no row limit", "Exact expected return on every bet", "Every best bet, every filter", "Full price check: order book, stake table, how much you can bet", "Alerts by email and browser, 20 rules", "My bets with profit and closing-price tracking", "25 saved views · 3 dashboards · CSV export"] },
  { id: "premium", name: "Premium", monthly: 29, line: "Everything, plus the browser extension.",
    points: ["Everything in Pro", "Chrome extension: expected return right on Polymarket", "Telegram and Discord alerts, 100 rules", "Unlimited saved views and dashboards"] },
] as const;

const usd = (x: number) => `$${Number.isInteger(x) ? x : x.toFixed(2)}`;

export function Plans({ demo }: { demo: boolean }) {
  const [annual, setAnnual] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Billing period" className="flex w-fit gap-1 rounded-full border border-border bg-input p-1 text-sm">
        {[false, true].map((a) => (
          <button key={String(a)} type="button" role="radio" aria-checked={annual === a} onClick={() => setAnnual(a)}
            className={`min-h-11 rounded-full px-4 ${annual === a ? "bg-accent-bg text-accent-soft" : "text-soft hover:text-text"}`}>
            {a ? <>Yearly <span className="text-accent-softer">· 2 months free</span></> : "Monthly"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const featured = p.id === "pro";
          const perMonth = annual ? (p.monthly * 10) / 12 : p.monthly;
          return (
            <section key={p.id} aria-labelledby={`plan-${p.id}`}
              className={`flex flex-col gap-4 rounded-card border p-5 md:p-6 ${featured ? "border-accent-border bg-accent-bg" : "border-border bg-surface"}`}>
              <div>
                <h3 id={`plan-${p.id}`} className="text-lg font-semibold">{p.name}</h3>
                <p className={`text-sm ${featured ? "text-accent-softer" : "text-muted"}`}>{p.line}</p>
              </div>
              <p className="flex items-baseline gap-1.5">
                <span className="font-heading text-[36px] font-bold leading-none tracking-[-0.02em]" data-testid={`price-${p.id}`}>{usd(Math.round(perMonth * 100) / 100)}</span>
                <span className={`text-sm ${featured ? "text-accent-softer" : "text-muted"}`}>/ month</span>
              </p>
              <p className={`-mt-2 min-h-5 text-xs ${featured ? "text-accent-softer" : "text-muted"}`}>
                {p.monthly === 0 ? "Free forever" : annual ? `${usd(p.monthly * 10)} billed yearly` : "7-day free trial"}
              </p>
              <ul className={`flex flex-1 flex-col gap-2 text-sm ${featured ? "text-accent-soft" : "text-soft"}`}>
                {p.points.map((x) => (
                  <li key={x} className="flex gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" className="mt-0.5 shrink-0" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    {x}
                  </li>
                ))}
              </ul>
              {/* ponytail: paid mode will send these to Stripe checkout (T-43); until then they open Best bets */}
              <Link href="/flags"
                className={`flex min-h-11 items-center justify-center rounded-input px-4 font-semibold ${featured ? "bg-accent text-on-accent hover:bg-accent-hover" : "border border-border bg-muted-bg hover:border-accent-border"}`}>
                {p.monthly === 0 ? "Start free" : "Start trial"}
              </Link>
            </section>
          );
        })}
      </div>
      {demo && <p className="text-xs text-muted">Demo: every feature is unlocked. No account or card needed.</p>}
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
