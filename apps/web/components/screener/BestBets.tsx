"use client";

// / "Best bets" (Hybrid artboard): title + inline stats, Today / closing-soon / results (docs/17), filter pills + sort
// (docs/13 §2), price-check chips, one card per game (docs/17 fix 2), Big payouts and Combos rows (docs/18 §6).
import { useEffect, useState } from "react";
import { backtestOnce, fetchFlags, type ApiGroup, type ApiRow, type BacktestResponse, type MarketsResponse } from "@/lib/api";
import { CLOSING_SOON, tierOf, type FilterState } from "@/lib/filters/state";
import { RETURN_HELP, ago, ret, formatCount, pays, price } from "@/lib/format";
import { REFRESH_WORDS, freshness } from "@/lib/freshness";
import { savePresetFromState } from "@/lib/presets";
import { useProfile } from "@/lib/repo/hooks";
import { TAXONOMY } from "@/lib/taxonomy";
import { BetCard } from "@/components/market/BetCard";
import { MarketCard } from "@/components/market/MarketCard";
import { drawerHref, useOpenDrawer } from "@/components/market/drawer";
import { SaveViewDialog, chipClass } from "@/components/presets/SaveViewDialog";
import { SuggestedCombos } from "@/components/combo/SuggestedCombos";
import { Count } from "@/components/kit";
import { CardSkeleton } from "@/components/market/bits";
import { FilterPills } from "@/components/search/FilterPills";
import { SearchChips } from "@/components/search/SearchChips";
import { AppliedPills } from "./AppliedPills";
import { ClosingSoon, ResultsTicker, TodayCard } from "./DayStrip";
import { EmptyState, ErrorState, StaleBanner } from "./States";
import { useDesktop } from "./useDesktop";
import { useNear } from "./useNear";
import { LockedBets } from "./LockedBets";
import { useEntitlements } from "@/lib/entitlements";
import { useMeta, useScreener } from "./useScreener";

const nf = formatCount;   // docs/18 §4: counts short, rounded down
const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** docs/17 fix 6: the price check as three quiet chips instead of a sentence (the full text is in the hover). */
function PriceChips({ f }: { f: MarketsResponse["facets"] }) {
  const v = f.verdicts;
  const chips = [
    v["worth it"] ? { n: v["worth it"], text: "fair fill", dot: "bg-accent", help: "The price you'd really pay keeps most of the gain." } : null,
    v.thin ? { n: v.thin, text: "spread eats most of it", dot: "bg-warning", help: "The gap between buyers and sellers eats most of the gain." } : null,
    v["not worth it"] ? { n: v["not worth it"], text: "hidden, price too high", dot: "bg-negative", help: "Hidden from Best bets: the price is too high right now." } : null,
  ].filter((c) => c !== null);
  if (!chips.length) return null;
  return (
    <ul aria-label="Price check" className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted md:ml-2">
      {chips.map((c) => (
        <li key={c.text} title={c.help} className="flex min-h-8 items-center gap-1.5">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${c.dot}`} />
          <span className="tabular-nums text-soft">{nf(c.n)}</span> {c.text}
        </li>
      ))}
    </ul>
  );
}

/** Backtest stats, inline next to the title (docs/17 fix 8). Fixed height so nothing shifts when they load. */
function StatTiles() {
  const [bt, setBt] = useState<BacktestResponse | null>(null);
  useEffect(() => void backtestOnce().then(setBt, () => {}), []);
  const t = bt?.chosen?.taker;
  const ok = !!t && typeof t.roi_pct === "number" && typeof t.flags === "number";
  return (
    <dl className="flex min-h-[28px] flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-muted">
      {ok && (
        <>
          <div className="flex items-baseline gap-1.5"><dd className="font-heading text-xl font-bold text-accent">{ret(t.roi_pct)}</dd><dt>avg return in testing</dt></div>
          <div className="flex items-baseline gap-1.5"><dd className="font-heading text-xl font-bold text-text"><Count n={t.flags} /></dd><dt>past bets tested</dt></div>
        </>
      )}
    </dl>
  );
}

const PAYS_CHIPS = [2, 5, 10] as const;

/** "2x+ · 5x+ · 10x+" quick payout chips (docs/18 §3). A pays filter widens the list to both tiers (tierOf). */
function PaysChips({ state, onChange }: { state: FilterState; onChange: (p: Partial<FilterState>) => void }) {
  return (
    <div role="group" aria-label="Payout" className="flex flex-none gap-2">
      {PAYS_CHIPS.map((x) => {
        const on = state.pays_min === x && state.pays_max === undefined;
        return (
          <button key={x} type="button" aria-pressed={on} className={chipClass(on)}
            onClick={() => onChange({ pays_min: on ? undefined : x, pays_max: undefined, page: 1 })}>
            Pays {x}x+
          </button>
        );
      })}
    </div>
  );
}

/** One slot per game: the best bet in it plus the others (when grouped), or one slot per bet (flat). */
type Slot = { rows: ApiRow[]; size: number };
function slotsOf(rows: ApiRow[], groups: ApiGroup[] | undefined): Slot[] {
  if (!groups) return rows.map((r) => ({ rows: [r], size: 1 }));
  return groups.map((g) => ({ rows: rows.slice(g.start, g.start + g.count), size: g.size })).filter((s) => s.rows.length);
}

/** "+3 more in this game": the other bets in the same game, inline under the card (docs/17 fix 2). */
function MoreInGame({ slot }: { slot: Slot }) {
  const [open, setOpen] = useState(false);
  const { open: openDrawer } = useOpenDrawer();
  const others = slot.rows.slice(1);
  if (slot.size < 2) return null;
  const ev = slot.rows[0]!.market;
  return (
    <div className="flex flex-col">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 self-start px-1 text-[13px] text-accent-hover hover:text-accent-soft">
        {open ? "Hide" : `+${nf(slot.size - 1)} more in this game`}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {open && (
        <ul className="flex flex-col rounded-inner border border-border bg-surface px-3 py-1 text-[13px]">
          {others.map(({ market: m, side: s }) => (
            <li key={`${m.id}:${s.side_index}`} className="border-b border-border last:border-0">
              <a href={drawerHref(m.id, s.side_index)} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openDrawer(m.id, s.side_index); }}
                className="flex min-h-11 items-center justify-between gap-3 py-2 hover:text-accent-hover">
                <span className="min-w-0"><span className="line-clamp-2">{m.question}</span><span className="text-xs text-muted">Bet {s.outcome} at {price(s.ask)}</span></span>
                <span className="flex-none font-heading font-semibold tabular-nums">Pays {pays(s.ask)}</span>
              </a>
            </li>
          ))}
          {slot.size > slot.rows.length && (
            <li className="py-2"><a href={`/event/${ev.event_id}`} className="text-accent-hover hover:text-accent-soft">All {nf(slot.size)} in this game</a></li>
          )}
        </ul>
      )}
    </div>
  );
}

function Cards({ slots, desktop, pro, dim }: { slots: Slot[]; desktop: boolean; pro: boolean; dim?: boolean }) {
  return (
    <ul className={`${desktop ? GRID : "flex flex-col gap-3"} transition-opacity duration-200 ease-out ${dim ? "opacity-60" : ""}`}>
      {slots.map((s) => {
        const r = s.rows[0]!;
        return (
          // desktop: card and "+N more" sit in two subgrid rows, so a row of cards stays one height
          // whether or not a game has more bets, and opening one list doesn't stretch its neighbours
          <li key={`${r.market.id}:${r.side.side_index}`} className={desktop ? "row-span-2 grid grid-rows-subgrid gap-y-1" : "flex flex-col gap-1"}>
            {desktop ? <BetCard r={r} pro={pro} /> : <MarketCard r={r} pro={pro} />}
            <MoreInGame slot={s} />
          </li>
        );
      })}
    </ul>
  );
}

/** One extra /api/flags query for a side section; refetches when the main filter changes. `initial`: the server's
 *  answer for the first key (no fetch for it). `near` false = wait (the row is still far below the fold). */
function useSide(state: FilterState, patch: Partial<FilterState> | null, { initial, near = true }: { initial?: MarketsResponse; near?: boolean } = {}) {
  const key = patch && JSON.stringify({ ...state, ...patch });
  const [res, setRes] = useState<{ key: string | null; data: MarketsResponse | null }>(() => ({ key: initial ? key : null, data: initial ?? null }));
  useEffect(() => {
    if (!key) return setRes({ key, data: null });
    if (!near || res.key === key) return;
    const ac = new AbortController();
    fetchFlags(JSON.parse(key), { signal: ac.signal }).then((data) => setRes({ key, data }), () => {});
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, near]);
  return res.key === key ? res.data : null;
}

/** "Big payouts" row (docs/18 §6): both tiers, pays 3x or more, horizontal scroll. Hidden while a pays filter is on. */
function BigPayouts({ state, pro }: { state: FilterState; pro: boolean }) {
  const off = state.pays_min !== undefined || state.pays_max !== undefined || state.sort.key === "pays";
  const [ref, near] = useNear();
  const data = useSide(state, off ? null : { tier: "all", pays_min: 3, pays_max: undefined, page: 1, page_size: 8, group_by_event: false }, { near });
  if (!data?.rows.length) return <div ref={ref} aria-hidden="true" />;
  return (
    <section aria-labelledby="big-h" data-testid="big-payouts" className="flex flex-col gap-3">
      <div>
        <h2 id="big-h" className="text-xl font-semibold">Big payouts</h2>
        <p className="mt-1 text-[13px] text-muted">Pays 3x or more. These lose more often than they win; the price is what&apos;s better than usual.</p>
      </div>
      <ul className="-mx-4 flex snap-x gap-3.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {data.rows.map((r) => (
          <li key={`${r.market.id}:${r.side.side_index}`} className="flex w-[300px] flex-none snap-start"><BetCard r={r} pro={pro} /></li>
        ))}
      </ul>
    </section>
  );
}

/** "More bets with an edge" (docs/18 §2): tier "edge", lower confidence, same filters. Only under plain Best bets. */
function MoreWithEdge({ state, desktop, pro }: { state: FilterState; desktop: boolean; pro: boolean }) {
  const [pages, setPages] = useState(1);
  const on = tierOf(state) === "best";
  const [ref, near] = useNear();
  const data = useSide(state, on ? { tier: "edge", win_prob_min: state.win_prob_min ?? 0, page: 1, page_size: 12 * pages } : null, { near });
  useEffect(() => setPages(1), [on]);
  if (!data?.rows.length) return <div ref={ref} aria-hidden="true" />;
  const slots = slotsOf(data.rows, data.groups);
  const left = (data.total_groups ?? data.total) - slots.length;
  return (
    <section aria-labelledby="edge-h" data-testid="more-edge" className="mt-6 flex flex-col gap-3">
      <div>
        <h2 id="edge-h" className="text-xl font-semibold">More bets with an edge <span className="text-base font-normal text-muted">· <Count n={data.total} /></span></h2>
        <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
          Also priced below how often bets like them won, but with lower confidence: fewer past events, or a payout band that did worse in testing. Each card shows its record.
        </p>
      </div>
      <Cards slots={slots} desktop={desktop} pro={pro} />
      {left > 0 && (
        <button type="button" onClick={() => setPages((p) => p + 1)} className="mx-auto min-h-11 rounded-input border border-border bg-surface px-5 text-sm hover:border-accent-border">
          Show more ({nf(left)} left)
        </button>
      )}
    </section>
  );
}

/** initial: the server's /api/flags page 1 for this URL, so the cards and the headline count are final on first
 *  paint (no client fetch, no LCP change). */
export function BestBets({ initial }: { initial?: { main: MarketsResponse; soon?: MarketsResponse; scanned_at?: number } }) {
  const sc = useScreener("flags", initial?.main);
  const { state, set, reset, data, more, moreGroups, loading, error } = sc;
  const meta = useMeta();
  const total = data?.total;
  const desktop = useDesktop();
  const pro = useProfile().numbers_mode === "pro";
  const live = useEntitlements().can("live_data");   // Free: the day's sample, then locked cards (docs/19 P3)
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ ok: boolean; msg: string } | null>(null);
  const soon = useSide(state, CLOSING_SOON, { initial: initial?.soon });

  const rows = data ? [...data.rows, ...more] : [];
  const slots = data ? slotsOf(rows, data.groups ? [...data.groups, ...moreGroups] : undefined) : [];
  const left = data ? (data.total_groups ?? data.total) - slots.length : 0;
  const split = desktop ? 12 : 4;   // Big payouts + Combos rows sit after the first cards (docs/18 §6); 12 fills 2, 3 or 4 columns
  const scanned = meta?.meta.scanned_at ?? initial?.scanned_at;   // server value first: the stale banner paints with the cards
  const topic = state.topics?.length === 1 ? TAXONOMY[state.topics[0]!]?.label : state.categories?.length === 1 ? TAXONOMY[state.categories[0]!]?.label : undefined;

  const save = async (name: string, emoji: string | null) => {
    try {
      await savePresetFromState(state, name, emoji);
      setSaving(false);
      setSaved({ ok: true, msg: `Saved “${name}”` });
    } catch (e) {
      setSaved({ ok: false, msg: e instanceof Error ? e.message : "Couldn't save this view." });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[34px]">
          {/* P9: Free sees the day's sample, so the headline says "10 of 1K", not a count it can't open */}
          {total !== undefined
            ? <>{!live && data && rows.length < total ? <>{rows.length} of </> : null}<Count n={total} /> {total === 1 ? "bet" : "bets"} where the odds lean your way</>
            : "Bets where the odds lean your way"}
        </h1>
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <p className="max-w-[760px] text-sm leading-normal text-muted">
            Each one is priced lower than how often bets like it have actually won, after Polymarket&apos;s fee and the price you&apos;d really pay.
            {/* P9: when the stale banner shows, it carries the scan age; saying it here too was the third stale notice */}
            {scanned && freshness(scanned) === "fresh" && <span suppressHydrationWarning className="whitespace-nowrap"> Scanned {ago(scanned)}.</span>}
          </p>
          <StatTiles />
        </div>
      </section>

      <TodayCard />
      <ClosingSoon rows={soon?.rows} />
      <ResultsTicker results={meta?.results} />

      <FilterPills state={state} mode="flags" facets={data?.facets} meta={meta} onChange={set} onReset={reset}>
        <button type="button" onClick={() => (setSaved(null), setSaving(true))} className="min-h-10 whitespace-nowrap px-2 text-[13px] text-muted hover:text-text">+ Save this view</button>
        <span role="status" className="text-[13px] text-accent-softer empty:hidden">{saved?.ok ? saved.msg : ""}</span>
      </FilterPills>

      {/* P9: one scrolling row on phones (Pays chips + Show every bet); the price-check counts wait for md+, where
          they fit beside the chips (the drawer carries the price check for each bet) */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <PaysChips state={state} onChange={set} />
        {data && data.total > 0 && <div className="max-md:hidden"><PriceChips f={data.facets} /></div>}
        <button type="button" aria-pressed={!state.group_by_event} onClick={() => set({ group_by_event: !state.group_by_event })} className={`${chipClass(!state.group_by_event)} flex-none md:ml-auto`}>
          Show every bet
        </button>
      </div>
      <SaveViewDialog open={saving} title="Save this view" error={saved && !saved.ok ? saved.msg : null} onSubmit={save} onClose={() => setSaving(false)} />
      <SearchChips q={state.q} search={data?.search} onChange={set} />
      <AppliedPills state={state} mode="flags" onChange={set} onReset={reset} />
      <StaleBanner scannedAt={scanned} />

      {error && !data ? (
        <ErrorState onRetry={sc.retry} what="best bets" error={error} />
      ) : !data ? (
        <ul className={desktop ? GRID : "flex flex-col gap-3"} aria-busy="true" aria-label="Loading best bets">
          {Array.from({ length: desktop ? 8 : 4 }, (_, i) => <li key={i} className="flex"><CardSkeleton /></li>)}
        </ul>
      ) : data.total === 0 ? (
        <EmptyState
          title={topic ? `Nothing in ${topic} right now` : "No best bets match these filters"}
          line={`Nothing with these filters is priced below how often similar bets have won. Prices refresh ${REFRESH_WORDS}.`}
          onReset={reset}
          link={{ href: "/markets", label: "Look in All markets" }}
        />
      ) : (
        <>
          {error && <ErrorState onRetry={sc.retry} what="best bets" error={error} />}
          <Cards slots={slots.slice(0, split)} desktop={desktop} pro={pro} dim={loading} />
          <BigPayouts state={state} pro={pro} />
          {tierOf(state) === "best" && <SuggestedCombos />}
          {slots.length > split && <Cards slots={slots.slice(split)} desktop={desktop} pro={pro} dim={loading} />}
          {!live && <LockedBets total={data.total} shown={rows.length} desktop={desktop} />}
          {live && left > 0 && (
            <button
              type="button"
              onClick={sc.loadMore}
              disabled={sc.loadingMore}
              className="mx-auto min-h-11 rounded-input border border-border bg-surface px-5 text-sm hover:border-accent-border"
            >
              {sc.loadingMore ? "Loading…" : `Show more (${nf(left)} left)`}
            </button>
          )}
          <MoreWithEdge state={state} desktop={desktop} pro={pro} />
          {!desktop && <p className="text-xs text-muted" title={RETURN_HELP}>Estimated return: {RETURN_HELP}</p>}
        </>
      )}
    </div>
  );
}
