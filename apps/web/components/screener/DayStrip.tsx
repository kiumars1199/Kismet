"use client";
// "Worth keeping open all day" pieces on Best bets (docs/17), all from real data:
// ClosingSoon (next 5 best bets closing within 3 h, live countdowns), ResultsTicker (live ledger, hidden until
// 20 bets have settled) and TodayCard (signed-in: the user's own saved bets, alerts and My bets P&L, never picks).
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApiRow, MetaResponse } from "@/lib/api";
import { countdown, edge, formatCount, money, pays, pct, price } from "@/lib/format";
import { summarize } from "@/lib/journal";
import { useMe } from "@/lib/me";
import { DEMO_MODE } from "@/lib/repo";
import { useCollection } from "@/lib/repo/hooks";
import { drawerHref, useOpenDrawer } from "@/components/market/drawer";
import type { WatchSnapshot } from "@/components/watch/WatchStar";

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Closing-soon strip: up to 5 rows, soonest first. Renders nothing when none close within 3 h. */
export function ClosingSoon({ rows }: { rows: ApiRow[] | undefined }) {
  const { open } = useOpenDrawer();
  const now = useNow(15_000);
  const live = (rows ?? []).filter((r) => r.market.closes_at * 1000 > now).slice(0, 5);
  if (!live.length) return null;
  return (
    <section aria-labelledby="soon-h" data-testid="closing-soon" className="flex min-w-0 flex-col gap-2">
      <h2 id="soon-h" className="font-sans text-[13px] font-semibold text-soft">Closing in the next 3 hours</h2>
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {live.map(({ market: m, side: s }) => {
          const mins = (m.closes_at * 1000 - now) / 60000;
          return (
            <li key={`${m.id}:${s.side_index}`} className="flex w-[264px] flex-none snap-start">
              <a href={drawerHref(m.id, s.side_index)} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); open(m.id, s.side_index); }}
                className="flex w-full flex-col gap-1 rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] transition-colors duration-200 ease-out hover:border-accent-border">
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold tabular-nums ${mins < 30 ? "text-warning" : "text-accent-softer"}`}>{countdown(m.closes_at, now)}</span>
                  <span className="text-muted">Pays {pays(s.ask)}</span>
                </span>
                <span className="truncate font-medium text-text">{m.question}</span>
                <span className="text-xs text-muted">Bet {s.outcome} at {price(s.ask)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const MIN_SETTLED = 20;   // docs/17: hidden until at least 20 best bets have settled

/** "Results so far: 41 best bets settled · 29 hit · +5.1¢ per $1 share" with wins and losses shown honestly. */
export function ResultsTicker({ results }: { results: MetaResponse["results"] }) {
  if (!results || results.graded < MIN_SETTLED) return null;
  return (
    <p data-testid="results-ticker" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <span className="text-soft">Results so far:</span>
      <span>{formatCount(results.graded)} best bets settled</span><span aria-hidden="true">·</span>
      <span>{formatCount(results.wins)} hit, {formatCount(results.losses)} lost ({pct(results.wins / results.graded)})</span>
      {results.avg_pnl !== null && <><span aria-hidden="true">·</span><span className={results.avg_pnl >= 0 ? "text-accent-softer" : "text-negative"}>{edge(results.avg_pnl)} per $1 share on average</span></>}
      <Link href="/track-record" className="text-accent-hover hover:text-accent-soft">See results</Link>
    </p>
  );
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Today, for signed-in users (and demo): only their own saved bets, alerts and bets. */
export function TodayCard() {
  const me = useMe();
  const watch = useCollection("watchlist");
  const events = useCollection("alert_events");
  const journal = useCollection("journal");
  const now = new Date();
  if (!DEMO_MODE && !me?.user) return null;
  const closing = watch.filter((w) => {
    const t = (w.snapshot as WatchSnapshot | null)?.closes_at;
    return typeof t === "number" && t * 1000 > now.getTime() && sameDay(new Date(t * 1000), now);
  });
  const fired = events.filter((e) => sameDay(new Date(e.fired_at), now));
  const s = summarize(journal);
  // one slim row, so the first cards stay above the fold (docs/17 fix 8)
  const stat = "flex min-h-11 min-w-0 items-center gap-1.5 rounded-input px-2 transition-colors duration-200 ease-out hover:bg-raised";
  return (
    <section aria-labelledby="today-h" data-testid="today" className="flex flex-wrap items-center gap-x-3 rounded-input border border-border bg-surface px-3 text-[13px] md:flex-nowrap">
      <h2 id="today-h" className="flex-none pl-1 font-sans text-[13px] font-semibold">Today</h2>
      <Link href="/watchlist" className={stat}>
        <span className="flex-none text-muted">Saved, closing today</span>
        <span className="truncate text-text">{closing.length ? `${formatCount(closing.length)} · ${(closing[0]!.snapshot as WatchSnapshot).question}` : "none"}</span>
      </Link>
      <Link href="/alerts" className={stat}>
        <span className="text-muted">Alerts fired</span>
        <span className="text-text">{fired.length || "none"}</span>
      </Link>
      <Link href="/journal" className={stat}>
        <span className="flex-none text-muted">My bets P&amp;L</span>
        <span className={`truncate ${s.settled ? (s.pnl >= 0 ? "text-accent-softer" : "text-negative") : "text-text"}`}>
          {s.bets ? `${s.settled ? money(s.pnl, true) : "no results yet"} · ${formatCount(s.open)} open` : "no bets logged"}
        </span>
      </Link>
    </section>
  );
}
