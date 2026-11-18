// Pricing (T-28, F-20): tier cards, feature table (docs/01 § Tiers, in display language), FAQ.
import Link from "next/link";
import { Faq, Plans } from "@/components/pricing/Plans";
import { DEMO_MODE } from "@/lib/config";
import { tradingEnv } from "@/lib/trade/server";

export const metadata = { title: "Pricing", description: "Free, Pro and Premium plans for MarketEdge. Start free; paid plans include a 7-day trial and cancel any time.", alternates: { canonical: "/pricing" } };

const ROWS: [string, string, string, string][] = [
  ["All open markets", "15 minutes behind, top 25 rows", "Live, unlimited", "Live, unlimited"],
  ["Estimated return on each bet", "As a range", "Exact", "Exact"],
  ["Best bets", "3 a day", "All", "All"],
  ["Filters", "Topic, sport, price", "All", "All"],
  ["Saved views", "1", "25", "Unlimited"],
  ["Dashboards", "—", "3", "Unlimited"],
  ["My list", "10 bets", "Unlimited", "Unlimited"],
  ["Alerts", "—", "Email + browser, 20 rules", "+ Telegram / Discord, 100 rules"],
  ["Price check (order book, stake table)", "First share only", "Full", "Full"],
  ["My bets: profit and closing-price tracking", "—", "Yes", "Yes"],
  ["Results and win-chance charts", "Yes", "Yes", "Yes"],
  ["Chrome extension", "—", "—", "Yes"],
  ["CSV export", "—", "Yes", "Yes"],
];

const PRICING_FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "What happens after the free trial?", a: "Pro and Premium start with 7 days free. Cancel before day 7 and you pay nothing. After that the plan renews monthly or yearly until you cancel." },
  { q: "Can I cancel any time?", a: "Yes. Cancel from your account page and you keep your plan until the end of the period you paid for." },
  { q: "Is this betting advice?", a: "No. MarketEdge is market analytics: everyone sees the same numbers, based on how past markets settled. It never looks at your bets to tell you what to buy, and any single bet can lose." },
  { q: "Do you place bets for me?", a: tradingEnv()
    ? "No. Each market links to Polymarket or Kalshi, where you decide and bet yourself. Paper trading on Kalshi's demo exchange (fake money) sends an order only after you confirm it, every time."
    : "No. MarketEdge never places orders. Each market links to Polymarket, where you decide and bet yourself." },
  { q: "Who can use it?", a: "Adults 18 and over, where prediction markets are legal for them." },
];

export default function Page() {
  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-14 pb-8">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[40px]">Plans</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Start free. Upgrade when you want live prices, every best bet and alerts. Results are free for everyone, so you can judge
          the method before you pay. <Link href="/track-record" className="text-accent-hover underline-offset-4 hover:underline">See results</Link>
        </p>
      </header>

      <Plans demo={DEMO_MODE} />

      <section aria-labelledby="compare-h" className="flex flex-col gap-4">
        <h2 id="compare-h" className="text-2xl font-semibold">Compare plans</h2>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="sticky left-0 bg-surface px-4 py-3 font-medium max-sm:w-32 max-sm:px-3 max-sm:shadow-[1px_0_0_var(--border)]">Feature</th>
                <th scope="col" className="px-4 py-3 font-medium">Free</th>
                <th scope="col" className="px-4 py-3 font-medium text-accent-softer">Pro · $19</th>
                <th scope="col" className="px-4 py-3 font-medium">Premium · $29</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([f, ...v]) => (
                <tr key={f} className="border-t border-border">
                  <th scope="row" className="sticky left-0 bg-surface px-4 py-2.5 text-left font-normal text-soft max-sm:w-32 max-sm:px-3 max-sm:shadow-[1px_0_0_var(--border)]">{f}</th>
                  {v.map((x, i) => <td key={i} className={`px-4 py-2.5 ${x === "—" ? "text-muted" : ""}`} title={x === "—" ? "not included" : undefined}>{x}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq-h" className="flex flex-col gap-4">
        <h2 id="faq-h" className="text-2xl font-semibold">Questions</h2>
        <Faq items={PRICING_FAQ} />
      </section>
    </article>
  );
}
