"use client";

// Market detail (F-04): drawer body and the shareable /m/[id] page. Live price check from /api/book every 5 s.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchBook, fetchMarket, type BookResponse, type MarketResponse } from "@/lib/api";
import { ago, basis, betLine, chance, closesIn, edge, money, pays, PAYS_HELP, pct, price, realisticReturn, ret, RETURN_HELP, sideProfit, sideRet, sideEdge, sidePts, formatCount, LONG_SHOT_LINE, winsAbout } from "@/lib/format";
import { useProfile } from "@/lib/repo/hooks";
import type { Execution, Side, StoreMarket } from "@/lib/types";
import { WatchStar } from "@/components/watch/WatchStar";
import { DrawerExtras } from "./DrawerExtras";
import { CurveChart } from "./CurveChart";
import { OddsBars, Skeleton, Val } from "./bits";
import { VERDICT_LABEL, chanceTone, priceVerdict, returnTone, topicLabel } from "./labels";
import { LowerConfidence, TierNote } from "./TierNote";
import { AddToCombo } from "@/components/combo/AddToCombo";
import { drawerHref } from "./DrawerHost";
import { TradeButton, VenueLink } from "@/components/trade/TradeButton";
import { Count } from "@/components/kit";

const card = "rounded-inner border border-border bg-raised p-4";
const LEVEL = { all: "all markets", cat: "category", niche: "niche", nmt: "niche + type" } as const;

/** Loads the market (unless given) and renders the detail. `onClose` = drawer mode. */
export function MarketDetail({ id, side, initial, onClose }: { id: string; side?: 0 | 1; initial?: MarketResponse; onClose?: () => void }) {
  const [res, setRes] = useState<{ id: string; data?: MarketResponse; error?: boolean }>(initial ? { id, data: initial } : { id: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (initial && initial.market.id === id) return;
    const ac = new AbortController();
    setRes({ id });
    fetchMarket(id, { signal: ac.signal }, true)
      .then((data) => setRes({ id, data }))
      .catch(() => !ac.signal.aborted && setRes({ id, error: true }));
    return () => ac.abort();
  }, [id, initial, retry]);

  const data = res.id === id ? res.data : undefined;
  if (res.id === id && res.error)
    return (
      <Frame onClose={onClose}>
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="font-semibold">Couldn&apos;t load this market.</p>
          <p className="text-sm text-muted">It may have closed since the last scan, or the data server didn&apos;t answer.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRetry((n) => n + 1)} className="min-h-11 rounded-input bg-accent px-4 font-semibold text-on-accent">Try again</button>
            <Link href="/status" className="flex min-h-11 items-center rounded-input border border-border px-4">Data status</Link>
          </div>
        </div>
      </Frame>
    );
  if (!data)
    return (
      <Frame onClose={onClose}>
        <div aria-busy="true" aria-label="Loading market" className="flex flex-col gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14" />
          <Skeleton className="h-36 rounded-inner" />
          <Skeleton className="h-40 rounded-inner" />
          <Skeleton className="h-48 rounded-inner" />
        </div>
      </Frame>
    );
  return <Detail data={data} side={side} onClose={onClose} />;
}

function Frame({ onClose, children, title }: { onClose?: () => void; children: React.ReactNode; title?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {onClose && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" data-autofocus className="flex size-11 flex-none items-center justify-center rounded-input bg-muted-bg text-muted hover:text-text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}
      {!onClose && title}
      {children}
    </div>
  );
}

type Live = { book?: BookResponse; error?: boolean };
function useLiveBook(m: StoreMarket, s: Side, stake?: number): Live {
  const [live, setLive] = useState<Live>({});
  useEffect(() => {
    setLive({});
    let stop = false;
    const ac = new AbortController();
    const load = () =>
      fetchBook({ token: m.tokens[s.side_index], q: s.win_prob, cat: m.category, stake }, { signal: ac.signal })
        .then((book) => !stop && setLive({ book }))
        .catch(() => !stop && !ac.signal.aborted && setLive((l) => ({ book: l.book, error: true })));
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 5000);
    return () => {
      stop = true;
      ac.abort();
      clearInterval(t);
    };
  }, [m.tokens, m.category, s.side_index, s.win_prob, stake]);
  return live;
}

function Detail({ data, side: sideParam, onClose }: { data: MarketResponse; side?: 0 | 1; onClose?: () => void }) {
  const m = data.market;
  const s = m.sides.find((x) => x.side_index === sideParam) ?? m.best;
  const other = m.sides.find((x) => x !== s);
  const pro = useProfile().numbers_mode === "pro";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [stake, setStake] = useState<number | undefined>();
  const live = useLiveBook(m, s, stake);

  // live check; scan-time fallback only for the side it was computed for
  const scanX = s.side_index === m.best.side_index ? m.execution : undefined;
  const liveX = live.book && live.book.book_ok ? (live.book as Execution & { warning?: string }) : undefined;
  const x: Execution | undefined = liveX ?? (live.book ? undefined : scanX);
  const bookState = live.book && !live.book.book_ok ? live.book.verdict : undefined;
  const realistic = realisticReturn(s);
  const c = chance(s.win_prob);

  const pickSide = (i: 0 | 1) => router.replace(pathname + (onClose ? drawerHref(m.id, i, params) : `?side=${i}`), { scroll: false });
  const H = onClose ? "h2" : "h1";

  return (
    <Frame
      onClose={onClose}
      title={
        <div>
          <div className="text-xs text-muted">{topicLabel(m)} · closes in {closesIn(m.closes_at)} <span title={new Date(m.closes_at * 1000).toLocaleString()}>({new Date(m.closes_at * 1000).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })})</span></div>
          <H className="mt-1.5 text-[22px] font-semibold leading-tight">{m.question}</H>
          {m.event !== m.question && <Link href={`/event/${m.event_id}`} className="mt-1 inline-block text-[13px] text-accent-hover hover:text-accent-soft">{m.event}</Link>}
        </div>
      }
    >
      <Actions m={m} s={s} />

      <section aria-label="Headline" className="rounded-inner border border-accent-border bg-accent-bg p-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] text-accent-softer">{betLine(s)}</div>
          {m.tier === "edge" && <LowerConfidence />}
        </div>
        <p data-testid="one-bet" className="mt-2 font-heading text-[26px] font-bold leading-tight text-text" title={basis(m, s)}>
          <span title={PAYS_HELP}>Pays {pays(s.ask)}</span> <span className="font-sans text-base font-medium text-accent-soft">· wins about {winsAbout(s.win_prob)}</span>
        </p>
        <p className={`text-[13px] ${s.ranges || s.edge > 0 ? "text-accent-softer" : "text-negative"}`}>{priceVerdict(s)} <span className="font-semibold">({sidePts(s)})</span></p>
        {s.win_prob < 0.25 && <p data-testid="long-shot-line" className="mt-2 text-[13px] leading-relaxed text-text">{LONG_SHOT_LINE}</p>}
        <div className="mt-2 flex items-baseline gap-2.5">
          <div className={`font-heading text-[30px] font-bold leading-none tracking-tight ${s.roi_pct >= 0 ? "text-accent-soft" : "text-negative"}`} title={basis(m, s)}>
            {pro ? sideEdge(s) : sideRet(s)}
          </div>
          <div className="text-[13px] text-accent-soft" title={RETURN_HELP}>
            <span className="underline decoration-dotted underline-offset-4">{pro ? "edge per share" : "expected return"}</span>
          </div>
        </div>
        {realistic !== null && !s.ranges && (
          <p className="mt-1.5 text-[13px] text-accent-soft">Similar past bets returned <strong>{ret(realistic)}</strong> on average.</p>
        )}
        <p className={`mt-1.5 text-[13px] ${chanceTone(c)}`}>{c ?? ""}{c && " · "}<span className="text-accent-soft">$100 bet → expect {sideProfit(s)}</span></p>
        {m.tier === "edge" && <TierNote s={s} className="mt-1.5 !text-accent-soft" />}
      </section>

      {other && (
        <div role="group" aria-label="Both sides" className="grid grid-cols-2 gap-2">
          {[...m.sides].map((x) => {
            const on = x === s;
            return (
              <button key={x.side_index} type="button" aria-pressed={on} onClick={() => pickSide(x.side_index)}
                className={`min-h-11 rounded-input border p-3 text-left ${on ? "border-accent-border bg-accent-bg/60" : "border-border bg-raised hover:border-accent-border"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{x.outcome}</span>
                  <span className="tabular-nums">{price(x.ask)} <span className="text-xs text-muted">· {pays(x.ask)}</span></span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span title={basis(m, x)}>won {pct(x.win_prob)} before</span>
                  <span className={returnTone(x.roi_pct)}>{pro ? sideEdge(x) : sideRet(x)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <section className={card} aria-labelledby="why">
        <h3 id="why" className="mb-3 font-sans text-sm font-semibold">{s.edge > 0 ? "Why it's a good price" : "How the price compares"}</h3>
        <OddsBars big market={s.ask} won={s.win_prob} labels={["Market's odds", "How often similar bets won"]} basis={basis(m, s)} />
        <p className="mt-3 text-[13px] leading-relaxed text-soft">
          Based on <Count n={s.model_events} /> past {topicLabel(m)} events ({m.market_type}, about {m.horizon_h} h before close
          {s.model_level === "all" || s.model_level === "cat" ? `, using all ${LEVEL[s.model_level]}` : ""}). Bets like this at {price(s.ask)} won {pct(s.win_prob)} of the time
          {s.win_prob_low > 0 ? `; a cautious estimate is ${pct(s.win_prob_low)}` : ""}.
        </p>
        {data.curve && <div className="mt-3"><CurveChart curve={data.curve} ask={s.ask} winProb={s.win_prob} /></div>}
      </section>

      <StakeSection x={x} live={!!liveX} fetchedAt={live.book?.fetched_at} error={live.error} bookState={bookState} scanAt={scanX && !liveX ? true : false} onStake={setStake} stake={stake} />

      <TrackRecord data={data} pro={pro} />
      <Warnings m={m} s={s} x={x} />

      <details className={`${card} text-[13px] text-soft`}>
        <summary className="cursor-pointer font-semibold text-text">Details for pros</summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
          {([
            ["Ask", price(x?.best_ask ?? s.ask)], ["Mid", price(x?.book_mid ?? s.mid)],
            ["Spread", price(x?.spread ?? m.spread)], ["Fee", price(x?.fee_at_ask ?? s.fee)],
            ["Edge", edge(x?.net_edge ?? s.edge)], ["Cautious edge", edge(s.edge_low)],
            ["Edge kept after spread", pct(x?.retention)], ["Win chance range", `${pct(s.win_prob_low)}–${pct(s.win_prob)}`],
            ["Model level", LEVEL[s.model_level] ?? s.model_level], ["Samples", `${formatCount(s.model_neff)} eff. · ${formatCount(s.model_events)} events`],
          ] as const).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 text-right"><Val v={v} /></dd></div>
          ))}
        </dl>
        {x && x.limit_price != null && x.limit_edge != null && x.limit_price > 0 && (
          <p className="mt-3 leading-relaxed">Prefer a limit order? At {price(x.limit_price)} your edge would be {edge(x.limit_edge)} per share, but it may not fill.</p>
        )}
        <p className="mt-2 text-xs text-muted">{basis(m, s)}</p>
      </details>

      <DrawerExtras market={m} side={s.side_index} />

      {data.event_markets.length > 0 && (
        <section aria-labelledby="others">
          <h3 id="others" className="mb-2 font-sans text-sm font-semibold">Other markets in this event</h3>
          <ul className="flex flex-col">
            {data.event_markets.slice(0, 8).map((o) => (
              <li key={o.id}>
                <Link href={onClose ? drawerHref(o.id, undefined, params) : `/m/${o.id}`} replace={!!onClose} scroll={!onClose}
                  className="flex min-h-11 items-center justify-between gap-3 border-t border-border py-2 text-[13px] hover:text-accent-hover">
                  <span className="line-clamp-2">{o.question}</span>
                  <span className={`flex-none tabular-nums ${returnTone(o.best.roi_pct)}`}>{pro ? sideEdge(o.best) : sideRet(o.best)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {data.event_markets.length > 8 && <Link href={`/event/${m.event_id}`} className="mt-2 inline-block text-[13px] text-accent-hover">All {data.event_markets.length + 1} markets in this event</Link>}
        </section>
      )}
    </Frame>
  );
}

function Actions({ m, s }: { m: StoreMarket; s: Side }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/m/${m.id}${s.side_index !== m.best.side_index ? `?side=${s.side_index}` : ""}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const btn = "flex min-h-11 items-center justify-center gap-1.5 rounded-input border border-border bg-muted-bg px-3.5 text-text hover:border-accent-border";
  return (
    <div className="flex flex-wrap gap-2">
      <VenueLink m={m} className="flex min-h-11 basis-full items-center sm:basis-0 sm:flex-1 justify-center rounded-input bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover" />
      <TradeButton m={m} s={s} className={btn} />
      <AddToCombo m={m} s={s} className={btn} />
      <div className={`${btn} px-1`}><WatchStar marketId={m.id} side={s.side_index} market={m} /></div>
      <Link href={`/alerts?market=${m.id}&side=${s.side_index}`} className={btn}>Alert me</Link>
      <button type="button" onClick={share} className={btn} aria-live="polite">{copied ? "Link copied" : "Share"}</button>
    </div>
  );
}

function StakeSection({ x, live, fetchedAt, error, bookState, scanAt, stake, onStake }: {
  x?: Execution; live: boolean; fetchedAt?: number; error?: boolean; bookState?: string; scanAt: boolean; stake?: number; onStake: (n: number | undefined) => void;
}) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const v = x?.verdict;
  const check =
    bookState ? <span className="text-warning">{VERDICT_LABEL[bookState as keyof typeof VERDICT_LABEL] ?? bookState}</span>
    : !x ? <span className="text-muted">{error ? "Live price unavailable" : "Checking the live price…"}</span>
    : v === "worth it" && (x.capacity_usd == null || x.capacity_usd >= 100) ? <span className="text-accent">Price check ✓ fair fill</span>
    : v === "worth it" && x.capacity_usd != null ? <span className="text-warning">Only ~{money(Math.round(x.capacity_usd))} available at this price</span>
    : <span className={v === "thin" ? "text-warning" : "text-negative"}>{VERDICT_LABEL[v!]}</span>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(text);
    onStake(Number.isFinite(n) && n > 0 && n <= 1e6 ? Math.round(n * 100) / 100 : undefined);
  };

  return (
    <section className={card} aria-labelledby="betnow">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 id="betnow" className="font-sans text-sm font-semibold">If you bet now</h3>
        <span className="text-xs" aria-live="polite">{check}</span>
      </div>
      {x && x.stakes.length > 0 ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-1 font-medium">You bet</th>
              <th scope="col" className="font-medium">You get back if it wins</th>
              <th scope="col" className="text-right font-medium">Expected profit</th>
            </tr>
          </thead>
          <tbody>
            {x.stakes.map((r) => (
              <tr key={r.stake_usd} className={r.stake_usd === stake ? "text-accent-soft" : ""}>
                <td className="py-1.5">{money(r.stake_usd)}{r.filled_usd < r.stake_usd - 0.01 && <span className="block text-xs text-warning">only {money(r.filled_usd)} fills</span>}</td>
                <td>{money(r.shares)}</td>
                <td className={`text-right ${r.expected_profit_usd >= 0 ? "text-accent" : "text-negative"}`}>{money(r.expected_profit_usd, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[13px] text-muted">{bookState ? "Nobody is selling this side right now, so there is no price to fill at." : error ? "The live order book didn't answer. The numbers above are from the last scan." : "Loading the live order book…"}</p>
      )}
      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Your own stake
          <span className="flex items-center rounded-[10px] border border-border bg-input focus-within:border-accent">
            <span className="pl-2.5 text-muted" aria-hidden="true">$</span>
            <input ref={input} type="number" inputMode="decimal" min={1} step="any" value={text} onChange={(e) => setText(e.target.value)} placeholder="250"
              className="min-h-10 w-full bg-transparent px-2 tabular-nums text-text placeholder:text-muted focus:outline-none" />
          </span>
        </label>
        <button type="submit" className="min-h-10 rounded-input border border-accent-border bg-accent-bg px-4 text-accent-soft hover:border-accent">Check</button>
      </form>
      {x && x.capacity_usd != null && x.capacity_usd > 0 && (
        <p className="mt-2.5 text-xs text-muted">The good price holds for bets up to about {money(Math.round(x.capacity_usd))}.</p>
      )}
      <p className="mt-1 text-xs text-muted">
        {live && fetchedAt ? `Live order book, checked ${ago(fetchedAt / 1000)}. Refreshes every 5 s.` : scanAt ? "From the last scan; live book unavailable." : ""}
      </p>
    </section>
  );
}

function TrackRecord({ data, pro }: { data: MarketResponse; pro: boolean }) {
  const m = data.market;
  const b = data.backtest;
  const cat = m.category;
  return (
    <section className={card} aria-labelledby="record">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id="record" className="font-sans text-sm font-semibold">Track record</h3>
        {m.validated ? (
          <span className="rounded-full border border-accent-border bg-accent-bg px-2.5 py-0.5 text-xs text-accent-soft">Tested on past data</span>
        ) : (
          <span className="rounded-full bg-muted-bg px-2.5 py-0.5 text-xs text-warning">Not validated</span>
        )}
      </div>
      {b ? (
        <p className="text-[13px] leading-relaxed text-soft">
          In our walk-forward test, <Count n={b.flags} /> past {cat} bets like these
          {b.win_rate !== undefined ? ` won ${pct(b.win_rate)} of the time` : ""}
          {b.roi_pct !== undefined ? ` and returned ${ret(b.roi_pct)} on average` : ""}
          {b.events !== undefined && <>, across <Count n={b.events} /> events</>}.
          {pro && b.t_stat !== undefined && <span className="text-muted" title="t-statistic: how far the result is from luck"> (t = {b.t_stat.toFixed(1)})</span>}
        </p>
      ) : (
        <p className="text-[13px] text-muted" title="not available">No past test covers {cat} markets yet.</p>
      )}
      {!m.validated && <p className="mt-2 text-[13px] text-warning">This kind of bet hasn&apos;t made money in testing yet. Treat the numbers as a rough guide.</p>}
    </section>
  );
}

function Warnings({ m, s, x }: { m: StoreMarket; s: Side; x?: Execution }) {
  const w: string[] = [];
  if (x && x.spread >= 0.05) w.push(`Wide spread: buyers and sellers are ${price(x.spread)} apart, so the price can move against you.`);
  if (x && x.verdict !== "not worth it" && x.capacity_usd != null && x.capacity_usd < 100) w.push(`Thin order book: only about ${money(Math.round(x.capacity_usd))} can be bought at a good price.`);
  if (s.edge >= 0.15) w.push("Unusually high: in testing, bets that looked this good earned far less than predicted.");
  if (s.model_events < 50) w.push(`Small evidence: only ${s.model_events} past events like this.`);
  if (s.model_level === "all" || s.model_level === "cat")
    w.push(`Few markets like this one, so the estimate leans on ${s.model_level === "all" ? "all markets" : `all ${m.category} markets`}.`);
  if (!w.length) return null;
  return (
    <section aria-label="Warnings" className="rounded-inner border border-warning/30 bg-warning/5 p-4">
      <ul className="flex flex-col gap-1.5 text-[13px] text-soft">
        {w.map((t) => (
          <li key={t} className="flex gap-2"><span aria-hidden="true" className="mt-1.5 size-1.5 flex-none rounded-full bg-warning" />{t}</li>
        ))}
      </ul>
    </section>
  );
}

