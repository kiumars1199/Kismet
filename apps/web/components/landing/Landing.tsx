// Landing for signed-out visitors at / (docs/19 P1, T-276). Server-rendered; the only client code is the three real BetCards.
// Order: hero (promise, 3 steps, Sign up free) → teaser (3 real best bets + 6 blurred placeholders) → proof → plans → FAQ.
// Every number is read from the scan (the Free store and gate, as a signed-out visitor is Free) or from backtest.json /
// ledger_summary.json. The blurred placeholders are constant shapes: no market data reaches the HTML for them.
import Link from "next/link";
import { BetCard } from "@/components/market/BetCard";
import { chosenResult } from "@/lib/data/model";
import { freeView } from "@/lib/data/gate";
import { listBody } from "@/lib/data/respond";
import { getStoreFor } from "@/lib/data/store";
import { bestBetsCount, bestBetsQuery } from "@/lib/data/counts";
import { behindWords, exactCount, formatCount, pct } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { SITE } from "@/lib/site";
import { FREE_BEST_BETS_A_DAY } from "@/lib/entitlements";
import { foldRows, tiles, weeksUp } from "@/lib/trackRecord";
import { Tiles } from "@/components/results/Tiles";
import { ProofLine } from "@/components/results/ProofLine";
import { HIT_RATE_VS_PROFIT, siteProof } from "@/lib/proof";
import { Plans } from "@/components/pricing/Plans";
import { DISCLAIMER } from "@/components/shell/Footer";
import { DEMO_MODE } from "@/lib/config";
import type { ApiRow } from "@/lib/api";
import { REFRESH_WORDS } from "@/lib/freshness";
import { zonedTime } from "@/lib/zone";
import { requestZone } from "@/lib/zone-server";
import s from "./landing.module.css";

const TIME = { hour: "numeric", minute: "2-digit" } as const;
const H2 = "font-heading text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[36px]";
const CTA = "inline-flex min-h-12 items-center justify-center rounded-input bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover";
const SIGNUP = "/signup";
/** Real best bets shown signed out; the rest of the teaser grid is placeholders. */
export const LANDING_REAL = 3;
export const LANDING_PLACEHOLDERS = 6;
export const LANDING_SAMPLE = "landing";
const FREE_ROWS = FREE_BEST_BETS_A_DAY;   // the same constant the server samples with (lib/data/respond.ts freeSample)

async function scan() {
  try {
    // The visitor is signed out, so Free: the same store, query, daily random sample and gate as a Free /api/flags
    // page 1 (lib/data/respond.ts listBody), keyed "landing" so every visitor sees the same 3 for the day.
    const store = freeView(await getStoreFor("free"));
    const page = await listBody(store, bestBetsQuery({ page_size: LANDING_REAL }), "free", LANDING_SAMPLE);
    if (!page) return null;
    return {
      total: bestBetsCount(store).total,   // T-288: the one Best bets count (lib/data/counts.ts), as on /status and Best bets
      rows: page.rows.slice(0, LANDING_REAL) as ApiRow[], scannedAt: store.meta.scanned_at,
      backtest: store.backtest, ledger: store.ledgerSummary ?? null, since: store.ledgerSince ?? null,
    };
  } catch {
    return null;   // engine output not there yet: the landing still explains the product, without numbers
  }
}

export async function Landing() {
  const [data, settings, zone] = await Promise.all([scan(), getSettings(), requestZone()]);   // zone: T-288, the visitor's
  const bt = data ? chosenResult(data.backtest) : undefined;
  const taker = bt?.taker;
  const weeks = data ? foldRows(data.backtest) : [];
  const top = data?.rows[0];
  const ask = top?.side.ask, won = top?.side.win_prob;
  const ledger = data?.ledger && data.ledger.graded > 0 ? data.ledger : null;
  const testDays = typeof data?.backtest.test_days === "number" ? data.backtest.test_days : null;
  const testWeeks = typeof data?.backtest.folds_run === "number" ? data.backtest.folds_run : weeks.length;
  const proof = data ? siteProof({ backtest: data.backtest, ledger: data.ledger, since: data.since }) : null;

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-24 pb-12 md:gap-32">
      {/* 1. Hero: one-line promise, how it works in 3 steps, one primary button */}
      <section aria-labelledby="hero-h" className="flex flex-col gap-12 pt-6 md:pt-14">
        <div className="flex max-w-3xl flex-col gap-6">
          <h1 id="hero-h" className="font-heading text-[48px] font-bold leading-[0.98] tracking-[-0.035em] text-balance md:text-[76px]">
            Less luck, more math.
          </h1>
          <p className="max-w-[40ch] text-[19px] leading-snug text-soft md:text-[21px]">
            Kismet finds prediction-market bets priced below how often bets like them have actually won, after the fee and the spread.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={SIGNUP} className={CTA}>Sign up free</Link>
            <span className="text-[15px] text-muted">{FREE_ROWS} best bets a day free, no card.</span>
          </div>
          {data && (
            <p className="flex items-center gap-2.5 text-[15px] text-muted" data-testid="landing-count">
              <span aria-hidden="true" className={`size-2 rounded-full bg-accent ${s.pulse}`} />
              <span>
                <strong className="font-semibold tabular-nums text-text" title={exactCount(data.total)}>{formatCount(data.total)}</strong>{" "}
                {data.total === 1 ? "bet" : "bets"} priced below their record in the latest scan
                {data.scannedAt ? <>, {zonedTime(data.scannedAt, zone, TIME)}</> : null}
              </span>
            </p>
          )}
        </div>
        <ol aria-label="How it works" className="grid gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-3">
          <Step n={1} title="Read the price" text={`Every open Polymarket market, ${REFRESH_WORDS}. The price is the market's guess at the chance.`}>
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
        <p className="-mt-8 text-xs text-muted">
          {ask === undefined ? "Bars show an example: a 40¢ price and a 50% record." : "Bars use the first best bet below."}
        </p>
      </section>

      {/* 2. Teaser: real best bets (Free gate), then blurred placeholders that carry no data */}
      <section aria-labelledby="teaser-h" className="flex flex-col gap-8">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="teaser-h" className={H2}>Today&apos;s best bets</h2>
          <p className="text-[17px] leading-relaxed text-soft">The top of the latest scan. Any single bet can lose.</p>
        </div>
        <div className="relative">
          <ul className="grid gap-4 md:grid-cols-3" data-testid="landing-teaser">
            {data?.rows.map((r) => (
              <li key={`${r.market.id}:${r.side.side_index}`} className="flex"><BetCard r={r} /></li>
            ))}
            {Array.from({ length: LANDING_PLACEHOLDERS }, (_, i) => <Placeholder key={i} i={i} />)}
          </ul>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-2/3 items-end justify-center bg-gradient-to-t from-background via-background/80 to-transparent pb-8">
            <Link href={SIGNUP} className={`${CTA} pointer-events-auto`} data-testid="teaser-cta" data-best-bets={data?.total} title={data && data.total >= 1000 ? `${exactCount(data.total)} best bets right now` : undefined}>
              {ctaLine(data?.total ?? 0)}
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Proof: the walk-forward test and the live record, in plain words, basis on hover */}
      {data && taker && typeof taker.win_rate === "number" && typeof taker.avg_price === "number" ? (
        <section aria-labelledby="proof-h" className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 id="proof-h" className={H2}>Tested on weeks it had never seen</h2>
            <p className="text-[17px] leading-relaxed text-soft" data-testid="hit-line">
              In testing, best bets{" "}
              <span className="cursor-help underline decoration-dotted underline-offset-4"
                title={`${exactCount(taker.flags)} best bets${taker.events !== undefined ? ` in ${exactCount(taker.events)} events` : ""}, ${testWeeks} ${testDays === 7 ? "weeks" : "test windows"}, each judged by a model fitted only on what came before. Bought at the asking price, after Polymarket's fee.`}>
                won {pct(taker.win_rate)} of the time vs {pct(taker.avg_price)} the price implied
              </span>
              . {HIT_RATE_VS_PROFIT}
            </p>
            <ProofLine p={proof!} className="text-[15px] leading-relaxed text-muted" />
            {ledger ? (
              <p className="text-sm text-muted" data-testid="ledger-line">
                Live so far: {exactCount(ledger.wins)} won and {exactCount(ledger.losses)} lost of {exactCount(ledger.graded)} settled ({pct(ledger.wins / ledger.graded)} won).
              </p>
            ) : null}
          </div>
          {weeks.length > 1 ? <WeekChart weeks={weeks} /> : null}
          <Tiles tiles={tiles(data.backtest).filter((t) => t.key !== "cents" && t.key !== "t")} />
          <p className="text-sm text-muted">
            Past results, after Polymarket&apos;s fee, buying at the asking price. Losing weeks and limits are on{" "}
            <Link href="/track-record" className="text-accent-hover underline underline-offset-4">Results</Link>.
          </p>
        </section>
      ) : null}

      {/* 4. Plans, with the real subscribe buttons */}
      <section id="plans" aria-labelledby="price-h" className="flex scroll-mt-24 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 id="price-h" className={H2}>Start free. Pay for live.</h2>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
            Free shows {FREE_ROWS} random best bets a day, {behindWords(settings.free_delay_min)}. Pro and Premium are live and start with 7 days free. Cancel any time.
          </p>
        </div>
        <Plans demo={DEMO_MODE} delay={settings.free_delay_min} />
        <Link href="/pricing#compare-h" className="min-h-11 w-fit content-center text-accent-hover underline-offset-4 hover:underline">Compare every feature</Link>
      </section>

      {/* 5. FAQ (native details, no JS), then the disclaimer */}
      <section aria-labelledby="faq-h" className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        <h2 id="faq-h" className={H2}>Questions</h2>
        <div className="flex flex-col gap-6">
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
          <p className="text-sm text-muted" data-testid="landing-disclaimer">{DISCLAIMER} Any single bet can lose.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-start gap-6 border-t border-border pt-16 md:items-center md:text-center">
        <h2 className={H2}>Today&apos;s list is already up.</h2>
        <p className="max-w-xl text-[17px] text-soft">{FREE_ROWS} best bets a day free. No card needed.</p>
        <Link href={SIGNUP} className={CTA}>Sign up free</Link>
      </section>
    </article>
  );
}

const FAQ: [string, string][] = [
  ["Is it free?", `Yes. A free account shows ${FREE_ROWS} best bets a day, a little behind live, with no card. Pro and Premium are live, show every bet and start with 7 days free.`],
  ["Do you place bets?", "No. Kismet shows the numbers. You bet on Polymarket yourself, or not at all."],
  ["Is this advice?", "No. It's market analytics. Everyone sees the same list, based on how past markets settled. Kismet never looks at your bets to tell you what to buy."],
  ["Can I lose money?", `Yes. ${HIT_RATE_VS_PROFIT} Past results don't promise future ones.`],
  ["Where do the numbers come from?", `Polymarket's live prices, checked ${REFRESH_WORDS}, and thousands of settled markets. The full test, including losing weeks, is on the Results page.`],
  ["Who can use it?", `Adults ${SITE.minAge}+ in ${SITE.countries}. Prediction markets aren't legal everywhere: check your local rules.`],
];

/** Honest about the Free tier: a free account sees FREE_ROWS of the day's best bets, not every one. */
export function ctaLine(total: number): string {
  if (total <= 0) return "Sign up free to see the list";
  return total <= FREE_ROWS ? `Sign up free to see all ${formatCount(total)} bets` : `Sign up free to see ${FREE_ROWS} of all ${formatCount(total)} bets`;
}

/** A blurred stand-in card: fixed shapes only, so no title, price or verdict reaches the page for it. */
function Placeholder({ i }: { i: number }) {
  const w = ["w-11/12", "w-4/5", "w-3/4", "w-5/6", "w-2/3", "w-full"][i % 6];
  return (
    <li aria-hidden="true" data-testid="placeholder" className="flex select-none">
      <div className="flex w-full flex-col gap-3 rounded-card border border-border bg-surface p-4 blur-[3px]">
        <div className="h-5 w-24 rounded-full bg-muted-bg" />
        <div className={`h-4 ${w} rounded bg-muted-bg`} />
        <div className="h-4 w-1/2 rounded bg-muted-bg" />
        <div className="mt-2 h-8 w-2/5 rounded bg-raised" />
        <div className="h-3 w-3/5 rounded bg-muted-bg" />
        <div className="mt-2 h-9 w-full rounded-input bg-raised" />
      </div>
    </li>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-4 bg-surface p-5 md:gap-5 md:p-7">
      <div className="flex flex-col justify-center gap-2.5 md:min-h-[76px]">{children}</div>
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
    <div className="flex items-center gap-3 text-xs">
      <span className="w-[76px] flex-none text-muted">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-muted-bg"><div className={`h-full rounded-full ${tone} ${s.fill} ${dim ? "opacity-50" : ""}`} style={{ width: w(p) }} /></div>
      <span className={`w-9 text-right tabular-nums ${dim ? "text-muted" : "text-soft"}`}>{pct(p)}</span>
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
  const up = weeksUp(weeks);
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
              className={`${s.bar} ${v >= 0 ? s.up : s.down}`} fill={x.dir === "up" ? "var(--accent)" : x.dir === "down" ? "var(--negative)" : "var(--market-bar)"}>
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
