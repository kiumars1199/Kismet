// Landing for signed-out visitors at / (docs/19 P1). Server-rendered; the only client code is the one real BetCard.
// Every number is read from the scan (same query, store and gate as /api/flags page 1) or from backtest.json.
import Link from "next/link";
import { BetCard } from "@/components/market/BetCard";
import { getMe } from "@/lib/auth/server";
import { can } from "@/lib/entitlements";
import { chosenResult } from "@/lib/data/model";
import { freeView, gateMarkets } from "@/lib/data/gate";
import { marketsPage } from "@/lib/data/respond";
import { getStoreFor } from "@/lib/data/store";
import { BEST_BETS_VERDICTS, FilterState } from "@/lib/filters/state";
import { behindWords, exactCount, formatCount, pct } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { SITE } from "@/lib/site";
import { foldRows, tiles } from "@/lib/trackRecord";
import { Tiles } from "@/components/results/Tiles";
import { Plans } from "@/components/pricing/Plans";
import { DEMO_MODE } from "@/lib/config";
import type { ApiRow } from "@/lib/api";
import s from "./landing.module.css";

const TIME = { hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" } as const;
const H2 = "font-heading text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[36px]";
const CTA = "inline-flex min-h-12 items-center justify-center rounded-input bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover";

async function scan() {
  try {
    const me = await getMe();
    const live = await getStoreFor(me.tier);
    const store = can(me.tier, "exact_edge") ? live : freeView(live);
    const state = FilterState.parse({ view: "flags", verdicts: BEST_BETS_VERDICTS, page_size: 1 });
    const page = gateMarkets(marketsPage(store, state), me.tier);
    return { total: page.total, row: (page.rows[0] ?? null) as ApiRow | null, scannedAt: store.meta.scanned_at, backtest: store.backtest };
  } catch {
    return null;   // engine output not there yet: the landing still explains the product, without numbers
  }
}

export async function Landing() {
  const [data, settings] = await Promise.all([scan(), getSettings()]);
  const bt = data ? chosenResult(data.backtest) : undefined;
  const taker = bt?.taker;
  const weeks = data ? foldRows(data.backtest) : [];
  const ask = data?.row?.side.ask, won = data?.row?.side.win_prob;

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-24 pb-12 md:gap-32">
      {/* Hero: mission, the live count, one real card from the scan */}
      <section className="grid items-center gap-10 pt-6 md:pt-14 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-[48px] font-bold leading-[0.98] tracking-[-0.035em] text-balance md:text-[76px]">
            Less luck, more math.
          </h1>
          <p className="max-w-[34ch] text-[19px] leading-snug text-soft md:text-[21px]">
            Kismet finds prediction-market bets priced below how often bets like them have actually won.
          </p>
          {data && (
            <p className="flex items-center gap-2.5 text-[15px] text-muted" data-testid="landing-count">
              <span aria-hidden="true" className={`size-2 rounded-full bg-accent ${s.pulse}`} />
              <span>
                <strong className="font-semibold tabular-nums text-text" title={exactCount(data.total)}>{formatCount(data.total)}</strong>{" "}
                {data.total === 1 ? "bet" : "bets"} priced below their record in the latest scan
                {data.scannedAt ? <>, {new Date(data.scannedAt * 1000).toLocaleTimeString("en-US", TIME)}</> : null}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/bets" className={CTA}>See today&apos;s bets free</Link>
            <a href="#plans" className="min-h-11 content-center font-medium text-text underline-offset-4 hover:underline">See plans</a>
            <Link href="/about" className="min-h-11 content-center text-soft underline-offset-4 hover:text-text hover:underline">How it works in detail</Link>
          </div>
        </div>
        {data?.row ? (
          <figure className="flex flex-col gap-2">
            <BetCard r={data.row} />
            <figcaption className="text-xs text-muted">Top best bet from the latest scan. Any single bet can lose.</figcaption>
          </figure>
        ) : null}
      </section>

      {/* Plans, right after the hero: what's paid and what each tier gets, with the real subscribe buttons */}
      <section id="plans" aria-labelledby="price-h" className="flex scroll-mt-24 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 id="price-h" className={H2}>Start free. Pay for live.</h2>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
            Free shows 10 random best bets a day, {behindWords(settings.free_delay_min)}. Pro and Premium are live and start with 7 days free. Cancel any time.
          </p>
        </div>
        <Plans demo={DEMO_MODE} delay={settings.free_delay_min} />
        <Link href="/pricing#compare-h" className="min-h-11 w-fit content-center text-accent-hover underline-offset-4 hover:underline">Compare every feature</Link>
      </section>

      {/* How it works: price vs. record → the gap → you decide */}
      <section aria-labelledby="how-h" className="flex flex-col gap-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="how-h" className={H2}>Same $1 payout. Different odds.</h2>
          <p className="text-[17px] leading-relaxed text-soft">
            A bet that pays $1 and costs 40¢ is the market saying 40%. Sometimes bets like it have won more often than that.
            {ask !== undefined && won !== undefined ? " The bars below use the bet above." : null}
          </p>
        </div>
        <ol className="grid gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-3">
          <Step n={1} title="Read the price" text="Every open Polymarket market, about every 10 minutes. The price is the market's guess at the chance.">
            <Bar label="Market says" p={ask ?? 0.4} tone="bg-market-bar" />
          </Step>
          <Step n={2} title="Check the record" text="How often did bets like this one win? Same topic, same kind of bet, same time before close, across thousands of settled markets.">
            <Bar label="Market says" p={ask ?? 0.4} tone="bg-market-bar" dim />
            <Bar label="Won before" p={won ?? 0.5} tone="bg-accent" />
          </Step>
          <Step n={3} title="Spot the gap, then decide" text="If the record beats the price after the fee and the spread, it's a best bet. You choose whether to bet, on Polymarket, yourself.">
            <Gap a={ask ?? 0.4} w={won ?? 0.5} />
          </Step>
        </ol>
        {ask === undefined ? <p className="text-xs text-muted">Bars show an example: a 40¢ price and a 50% record.</p> : null}
      </section>

      {/* Proof */}
      {data && taker ? (
        <section aria-labelledby="proof-h" className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 id="proof-h" className={H2}>Tested on weeks it had never seen</h2>
            <p className="text-[17px] leading-relaxed text-soft">
              {typeof taker.win_rate === "number" && taker.win_rate < 0.5 ? (
                <>Most best bets lose: in testing they won {pct(taker.win_rate)} of the time. The edge is the price. Each win paid more than the record said it should cost.</>
              ) : (
                <>In testing they won {pct(taker.win_rate)} of the time, so plenty still lost. The edge is the price, not a sure result.</>
              )}
            </p>
          </div>
          {weeks.length > 1 ? <WeekChart weeks={weeks} /> : null}
          <Tiles tiles={tiles(data.backtest).filter((t) => t.key !== "cents" && t.key !== "t")} />
          <p className="text-sm text-muted">
            Past results, after Polymarket&apos;s fee, buying at the asking price. Losing weeks and limits are on{" "}
            <Link href="/track-record" className="text-accent-hover underline underline-offset-4">Results</Link>.
          </p>
        </section>
      ) : null}


      {/* FAQ: native details, no JS */}
      <section aria-labelledby="faq-h" className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        <h2 id="faq-h" className={H2}>Questions</h2>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 flex-none text-muted transition-transform group-open:rotate-45"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </summary>
              <p className="max-w-[65ch] pb-5 leading-relaxed text-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-start gap-6 border-t border-border pt-16 md:items-center md:text-center">
        <h2 className={H2}>Today&apos;s list is already up.</h2>
        <p className="max-w-xl text-[17px] text-soft">No card needed. Look first, decide later.</p>
        <Link href="/bets" className={CTA}>See today&apos;s bets free</Link>
      </section>
    </article>
  );
}

const FAQ: [string, string][] = [
  ["Is this betting advice?", "No. It's market analytics. Everyone sees the same list, based on how past markets settled. Kismet never looks at your bets to tell you what to buy."],
  ["Can I lose money?", "Yes. Any single bet can lose, and most best bets do. The idea is that, over many bets, paying less than the record says can come out ahead. Past results don't promise future ones."],
  ["Do you place bets for me?", "No. Kismet shows the numbers. You bet on Polymarket yourself, or not at all."],
  ["Where do the numbers come from?", "Polymarket's live prices, checked about every 10 minutes, and thousands of settled markets. The full test, including losing weeks, is on the Results page."],
  ["Who can use it?", `Adults ${SITE.minAge}+ in ${SITE.countries}. Prediction markets aren't legal everywhere: check your local rules.`],
];

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-5 bg-surface p-6 md:p-7">
      <div className="flex min-h-[76px] flex-col justify-center gap-2.5">{children}</div>
      <h3 className="flex items-baseline gap-2.5 text-lg font-semibold">
        <span className="font-heading text-sm text-accent tabular-nums">{n}</span>{title}
      </h3>
      <p className="text-[15px] leading-relaxed text-muted">{text}</p>
    </li>
  );
}

const w = (p: number) => `${Math.max(2, Math.min(100, p * 100))}%`;

function Bar({ label, p, tone, dim }: { label: string; p: number; tone: string; dim?: boolean }) {
  return (
    <div className={`flex items-center gap-3 text-xs ${dim ? "opacity-50" : ""}`}>
      <span className="w-[76px] flex-none text-muted">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-muted-bg"><div className={`h-full rounded-full ${tone} ${s.fill}`} style={{ width: w(p) }} /></div>
      <span className="w-9 text-right tabular-nums text-soft">{pct(p)}</span>
    </div>
  );
}

function Gap({ a, w: won }: { a: number; w: number }) {
  const pts = Math.round((won - a) * 100);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="relative h-2.5 rounded-full bg-muted-bg">
        <div className="absolute inset-y-0 left-0 rounded-full bg-market-bar" style={{ width: w(a) }} />
        <div className={`absolute inset-y-0 rounded-r-full bg-accent ${s.gap}`} style={{ left: w(a), width: `${Math.max(1, (won - a) * 100)}%` }} />
      </div>
      <p className="text-muted">
        Record beats price by <strong className="font-semibold tabular-nums text-accent-hover">{pts > 0 ? `+${pts}` : pts} pts</strong>
      </p>
    </div>
  );
}

/** Weekly return of best bets in the walk-forward test (backtest.json folds). Server SVG, no chart library. */
function WeekChart({ weeks }: { weeks: ReturnType<typeof foldRows> }) {
  const vals = weeks.map((x) => x.ret ?? 0);
  const max = Math.max(1, ...vals.map(Math.abs));
  const W = 600, H = 160, mid = H / 2, bw = W / weeks.length;
  const up = weeks.filter((x) => (x.ret ?? 0) > 0).length;
  return (
    <figure className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 md:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">Return of best bets, week by week</span>
        <span className="text-muted">{up} of {weeks.length} weeks up</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full" role="img"
        aria-label={`Weekly return in testing: ${up} of ${weeks.length} weeks up. ${weeks.map((x) => `${x.week} ${x.retText}`).join(", ")}.`}>
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {weeks.map((x, i) => {
          const v = x.ret ?? 0, h = Math.max(1, (Math.abs(v) / max) * (mid - 4));
          return (
            <rect key={i} x={i * bw + bw * 0.15} width={bw * 0.7} y={v >= 0 ? mid - h : mid} height={h} rx="1.5"
              className={`${s.bar} ${v >= 0 ? s.up : s.down}`} fill={x.ret === null ? "var(--market-bar)" : v >= 0 ? "var(--accent)" : "var(--negative)"}>
              <title>{`${x.week}: ${x.retText}${x.bets ? `, ${x.bets} bets` : ""}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-muted tabular-nums">
        <span>{weeks[0]?.week}</span>
        <span>{weeks.at(-1)?.week}</span>
      </div>
    </figure>
  );
}
