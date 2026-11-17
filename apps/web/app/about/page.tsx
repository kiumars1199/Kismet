// Landing at /about (T-28, F-20; moved from / by T-70, docs/13). Live counters and preview cards come from the store; tiles from backtest.json.
import Link from "next/link";
import { Faq, Plans } from "@/components/pricing/Plans";
import { Tiles } from "@/components/results/Tiles";
import { DEMO_MODE } from "@/lib/config";
import { chosenResult } from "@/lib/data/model";
import { getTier } from "@/lib/auth/server";
import { gateMarket } from "@/lib/data/gate";
import { getStoreFor } from "@/lib/data/store";
import { apply } from "@/lib/filters/apply";
import { FilterState } from "@/lib/filters/state";
import { DASH, RETURN_HELP, chance, closesIn, pct, price, sideProfit, sideRet } from "@/lib/format";
import { TAXONOMY } from "@/lib/taxonomy";
import { tiles } from "@/lib/trackRecord";
import type { Side, StoreMarket } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "How it works" };

const n = (x: number | undefined) => (typeof x === "number" ? x.toLocaleString("en-US") : DASH);

const STEPS: [string, string][] = [
  ["Read the price", "A Yes at 68¢ means the market says 68%. We check every open Polymarket market, every 2 hours."],
  ["Check the history", "How often did bets like this one win? Same sport or topic, same kind of bet, same time before close, across thousands of settled markets."],
  ["Show the gap", "When bets like it won more often than the price says, after the fee and what you'd really pay, it's a best bet. You decide what to do with it."],
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "What is expected return?", a: <>{RETURN_HELP} A +10% expected return means about +$10 on a $100 bet, on average, over many bets like it.</> },
  { q: "Is this betting advice?", a: "No. It's market analytics. Everyone sees the same numbers, based on how past markets settled. MarketEdge never looks at your bets to tell you what to buy, and any single bet can lose." },
  { q: "How is it tested?", a: <>Week by week, on markets the model had never seen: each week it only knows what happened before, and we check how its best bets settled. Losing weeks and limits are shown on <Link href="/track-record" className="text-accent-hover underline-offset-4 hover:underline">Results</Link>.</> },
  { q: "Which markets do you cover?", a: "Polymarket today. Kalshi later, once we have their permission to use the data." },
];

export default async function Page() {
  const tier = await getTier();   // landing preview: same tier shaping and Free delay as the API (docs/15)
  const store = await getStoreFor(tier);
  const page = apply(store, FilterState.parse({ view: "flags", verdicts: ["worth it"], page_size: 3 }));
  const top = (page.groups ?? []).map((g) => g.best).map(({ market, side }) => {
    const m = gateMarket(market, tier);
    return { market: m, side: m.sides.find((x) => x.side_index === side.side_index) ?? m.best };
  });
  const bestCount = apply(store, FilterState.parse({ view: "flags", verdicts: ["worth it", "thin"] })).total; // same filter as the Best bets page (BEST_BETS_VERDICTS)
  const tested = chosenResult(store.backtest)?.taker;

  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-20 pb-8 md:gap-24">
      <section className="grid items-end gap-10 pt-4 md:pt-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-6">
          <h1 className="text-[44px] font-bold leading-[1.02] tracking-[-0.03em] md:text-[64px]">Same payout. Different odds.</h1>
          <p className="max-w-xl text-[17px] leading-relaxed text-soft">
            Every Polymarket bet pays $1 if it hits. Some cost less than how often bets like them have actually won.
            MarketEdge finds those, after the fee and the price you&apos;d really pay.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/markets" className="flex min-h-12 items-center rounded-input bg-accent px-6 font-semibold text-on-accent hover:bg-accent-hover">Open screener</Link>
            <Link href="/" className="flex min-h-12 items-center rounded-input border border-border bg-muted-bg px-5 font-medium hover:border-accent-border">See best bets</Link>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Counter label="markets checked" value={n(store.meta.markets_scanned)} />
          <Counter label="best bets right now" value={n(bestCount)} accent />
          <Counter label="past bets tested" value={n(tested?.flags)} />
        </dl>
      </section>

      <section aria-labelledby="how-h" className="flex flex-col gap-6">
        <h2 id="how-h" className="text-[28px] font-semibold tracking-[-0.01em]">How it works</h2>
        <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="font-heading text-sm font-semibold text-accent">Step {i + 1}</span>
              <h3 className="text-lg font-semibold">{t}</h3>
              <p className="text-sm leading-relaxed text-soft">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="now-h" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="now-h" className="text-[28px] font-semibold tracking-[-0.01em]">Best bets right now</h2>
            <p className="mt-1 text-sm text-muted" title={RETURN_HELP}>Top 3 by expected return, among bets with at least a 40% chance. Live from the last scan.</p>
          </div>
          <Link href="/" className="flex min-h-11 items-center text-accent-hover hover:underline">All {n(bestCount)} best bets</Link>
        </div>
        {top.length ? (
          <div className="grid gap-3.5 md:grid-cols-3">
            {top.map((r, i) => <PreviewCard key={r.market.id} m={r.market} s={r.side} first={i === 0} />)}
          </div>
        ) : (
          <p className="rounded-card border border-border bg-surface p-6 text-soft">No best bets in the last scan. The next scan may find some.</p>
        )}
      </section>

      <section aria-labelledby="results-h" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="results-h" className="text-[28px] font-semibold tracking-[-0.01em]">How they did in testing</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">Best bets on past weeks the model had never seen, compared with buying every bet. Historical results, not a promise.</p>
          </div>
          <Link href="/track-record" className="flex min-h-11 items-center text-accent-hover hover:underline">Full results and limits</Link>
        </div>
        <Tiles tiles={tiles(store.backtest).filter((t) => t.key !== "cents" && t.key !== "t")} /* cents + t-stat stay on Results */ />
      </section>

      <section aria-labelledby="plans-h" className="flex flex-col gap-6">
        <h2 id="plans-h" className="text-[28px] font-semibold tracking-[-0.01em]">Plans</h2>
        <Plans demo={DEMO_MODE} />
        <Link href="/pricing" className="flex min-h-11 w-fit items-center text-accent-hover hover:underline">Compare every feature</Link>
      </section>

      <section aria-labelledby="faq-h" className="flex flex-col gap-6">
        <h2 id="faq-h" className="text-[28px] font-semibold tracking-[-0.01em]">Questions</h2>
        <Faq items={FAQ} />
      </section>
    </article>
  );
}

function Counter({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`font-heading text-[28px] font-bold leading-tight tracking-[-0.02em] md:text-[34px] ${accent ? "text-accent" : ""}`}>{value}</dd>
    </div>
  );
}

// Simple Best bet card in the BetCard style (Lane C1 owns components/market/BetCard.tsx).
function PreviewCard({ m, s, first }: { m: StoreMarket; s: Side; first: boolean }) {
  const tag = TAXONOMY[`${m.category}.${m.niche}`]?.label ?? TAXONOMY[m.category]?.label ?? m.category;
  const bar = (p: number) => `${Math.max(0, Math.min(100, p * 100))}%`;
  return (
    <Link href={`/m/${m.id}`} data-testid="preview-card"
      className={`flex flex-col gap-3.5 rounded-card border p-[18px] hover:border-accent-border ${first ? "border-accent-border bg-surface" : "border-border bg-surface"}`}>
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="rounded-full bg-muted-bg px-2.5 py-0.5">{tag}</span>
        <span>Closes in {closesIn(m.closes_at)}</span>
      </div>
      <p className="min-h-[42px] text-base font-semibold leading-snug">{m.question}</p>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-muted">Expected return</div>
          <div className="font-heading text-[36px] font-bold leading-[1.1] tracking-[-0.02em] text-accent">{sideRet(s)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Bet</div>
          <div className="font-semibold">{s.outcome} · {price(s.ask)}</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs">
        <BarRow label="Market says" value={pct(s.ask)} width={bar(s.ask)} fill="bg-market-bar" />
        <BarRow label="Won before" value={pct(s.win_prob)} width={bar(s.win_prob)} fill="bg-accent" strong />
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3 text-[13px]">
        <span className="text-muted">$100 bet → <span className="text-text">expect {sideProfit(s)}</span></span>
        <span className="text-accent-softer">{chance(s.win_prob) ?? DASH}</span>
      </div>
    </Link>
  );
}

function BarRow({ label, value, width, fill, strong }: { label: string; value: string; width: string; fill: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] text-muted">{label}</span>
      <div className="h-2 flex-1 rounded bg-muted-bg"><div className={`h-2 rounded ${fill}`} style={{ width }} /></div>
      <span className={`w-[34px] text-right ${strong ? "text-accent-soft" : ""}`}>{value}</span>
    </div>
  );
}
