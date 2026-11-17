"use client";

// / "Best bets" (Hybrid artboard): title + stat tiles, filter pills + sort (docs/13 §2), card grid, price-check strip.
import { useEffect, useState } from "react";
import { backtestOnce, fetchFlags, type ApiRow, type BacktestResponse, type MarketsResponse } from "@/lib/api";
import { tierOf, type FilterState } from "@/lib/filters/state";
import { RETURN_HELP, ago, ret, formatCount } from "@/lib/format";
import { savePresetFromState } from "@/lib/presets";
import { useProfile } from "@/lib/repo/hooks";
import { TAXONOMY } from "@/lib/taxonomy";
import { BetCard } from "@/components/market/BetCard";
import { MarketCard } from "@/components/market/MarketCard";
import { SaveViewDialog, chipClass } from "@/components/presets/SaveViewDialog";
import { SuggestedCombos } from "@/components/combo/SuggestedCombos";
import { Count } from "@/components/kit";
import { Skeleton } from "@/components/market/bits";
import { FilterPills } from "@/components/search/FilterPills";
import { SearchChips } from "@/components/search/SearchChips";
import { AppliedPills } from "./AppliedPills";
import { EmptyState, ErrorState, StaleBanner } from "./States";
import { useDesktop } from "./useDesktop";
import { useMeta, useScreener } from "./useScreener";

const nf = formatCount;   // docs/18 §4: counts short, rounded down
const short = (label: string) => label.split(" & ")[0]!;

/** "Price check: 575 fair fill · 28 where the spread eats most of it · 1 hidden (price too high right now)". */
function PriceStrip({ f, total }: { f: MarketsResponse["facets"]; total: number }) {
  const v = f.verdicts;
  const cats = Object.entries(f.categories).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const parts = [
    v["worth it"] ? `${nf(v["worth it"])} fill at a fair price` : null,
    v.thin ? `${nf(v.thin)} where the price you’d really pay eats most of the gain` : null,
  ].filter(Boolean);
  const hidden = v["not worth it"] ?? 0;
  return (
    <p className="text-[13px] leading-relaxed text-muted">
      Of these {nf(total)}: {parts.join(", ") || "none checked yet"}.
      {hidden > 0 && ` ${nf(hidden)} more ${hidden === 1 ? "is" : "are"} hidden because the price is too high right now.`}
      {cats.length > 0 && ` By topic: ${cats.map(([id, n]) => `${nf(n)} ${short(TAXONOMY[id]?.label ?? id).toLowerCase()}`).join(", ")}.`}
    </p>
  );
}

function StatTiles() {
  const [bt, setBt] = useState<BacktestResponse | null>(null);
  useEffect(() => void backtestOnce().then(setBt, () => {}), []);
  const t = bt?.chosen?.taker;
  if (!t || typeof t.roi_pct !== "number" || typeof t.flags !== "number") return null;
  return (
    <dl className="flex gap-7">
      <div className="flex flex-col-reverse">
        <dt className="text-xs text-muted">avg return in testing</dt>
        <dd className="font-heading text-[30px] font-bold text-accent">{ret(t.roi_pct)}</dd>
      </div>
      <div className="flex flex-col-reverse">
        <dt className="text-xs text-muted">past bets tested</dt>
        <dd className="font-heading text-[30px] font-bold"><Count n={t.flags} /></dd>
      </div>
    </dl>
  );
}

const PAYS_CHIPS = [2, 5, 10] as const;

/** "2x+ · 5x+ · 10x+" quick payout chips (docs/18 §3). A pays filter widens the list to both tiers (tierOf). */
function PaysChips({ state, onChange }: { state: FilterState; onChange: (p: Partial<FilterState>) => void }) {
  return (
    <div role="group" aria-label="Payout" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
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

function Cards({ rows, desktop, pro, dim, first }: { rows: ApiRow[]; desktop: boolean; pro: boolean; dim?: boolean; first?: boolean }) {
  return desktop ? (
    <ul className={`grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))] ${dim ? "opacity-60" : ""}`}>
      {rows.map((r, i) => (
        <li key={`${r.market.id}:${r.side.side_index}`} className="flex">
          <BetCard r={r} highlight={!!first && i === 0} help={!!first && i === 0} pro={pro} />
        </li>
      ))}
    </ul>
  ) : (
    <ul className={`flex flex-col gap-2.5 ${dim ? "opacity-60" : ""}`}>
      {rows.map((r) => <li key={`${r.market.id}:${r.side.side_index}`}><MarketCard r={r} pro={pro} /></li>)}
    </ul>
  );
}

/** One extra /api/flags query for a side section; refetches when the main filter changes. */
function useSide(state: FilterState, patch: Partial<FilterState> | null) {
  const [data, setData] = useState<MarketsResponse | null>(null);
  const key = patch && JSON.stringify({ ...state, ...patch });
  useEffect(() => {
    if (!key) return setData(null);
    const ac = new AbortController();
    fetchFlags(JSON.parse(key), { signal: ac.signal }).then(setData, () => {});
    return () => ac.abort();
  }, [key]);
  return data;
}

/** "Big payouts" row (docs/18 §6): both tiers, pays 3x or more, horizontal scroll. Hidden while a pays filter is on. */
function BigPayouts({ state, pro }: { state: FilterState; pro: boolean }) {
  const off = state.pays_min !== undefined || state.pays_max !== undefined || state.sort.key === "pays";
  const data = useSide(state, off ? null : { tier: "all", pays_min: 3, pays_max: undefined, page: 1, page_size: 8, group_by_event: false });
  if (!data?.rows.length) return null;
  return (
    <section aria-labelledby="big-h" data-testid="big-payouts" className="flex flex-col gap-3">
      <div>
        <h2 id="big-h" className="text-xl font-semibold">Big payouts</h2>
        <p className="mt-1 text-[13px] text-muted">Pays 3x or more. These lose more often than they win; the price is what&apos;s better than usual.</p>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
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
  const data = useSide(state, on ? { tier: "edge", win_prob_min: state.win_prob_min ?? 0, page: 1, page_size: 12 * pages } : null);
  useEffect(() => setPages(1), [on]);
  if (!data?.rows.length) return null;
  return (
    <section aria-labelledby="edge-h" data-testid="more-edge" className="mt-6 flex flex-col gap-3">
      <div>
        <h2 id="edge-h" className="text-xl font-semibold">More bets with an edge <span className="text-base font-normal text-muted">· <Count n={data.total} /></span></h2>
        <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
          Also priced below how often bets like them won, but with lower confidence: fewer past events, or a payout band that did worse in testing. Each card shows its record.
        </p>
      </div>
      <Cards rows={data.rows} desktop={desktop} pro={pro} />
      {data.rows.length < data.total && (
        <button type="button" onClick={() => setPages((p) => p + 1)} className="mx-auto min-h-11 rounded-input border border-border bg-surface px-5 text-sm hover:border-accent-border">
          Show more ({nf(data.total - data.rows.length)} left)
        </button>
      )}
    </section>
  );
}

export function BestBets() {
  const sc = useScreener("flags");
  const { state, set, reset, data, more, loading, error } = sc;
  const meta = useMeta();
  const desktop = useDesktop();
  const pro = useProfile().numbers_mode === "pro";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ ok: boolean; msg: string } | null>(null);

  const rows = data ? [...data.rows, ...more] : [];
  const split = desktop ? 6 : 4;   // Big payouts + Combos rows sit after the first cards (docs/18 §6)
  const scanned = meta?.meta.scanned_at;

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
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <section className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-[880px]">
          <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[40px]">
            {data ? <><Count n={data.total} /> {data.total === 1 ? "bet" : "bets"} where the odds lean your way</> : "Bets where the odds lean your way"}
          </h1>
          <p className="mt-2.5 text-[15px] leading-normal text-muted">
            Each one is priced lower than how often bets like it have actually won, after Polymarket&apos;s fee and the price you&apos;d really pay.
            {scanned && <span className="whitespace-nowrap"> Scanned {ago(scanned)}.</span>}
          </p>
        </div>
        <StatTiles />
      </section>

      <FilterPills state={state} mode="flags" facets={data?.facets} meta={meta} onChange={set} onReset={reset}>
        <button type="button" onClick={() => (setSaved(null), setSaving(true))} className="min-h-10 whitespace-nowrap px-2 text-[13px] text-muted hover:text-text">+ Save this view</button>
        <span role="status" className="text-[13px] text-accent-softer empty:hidden">{saved?.ok ? saved.msg : ""}</span>
      </FilterPills>

      <PaysChips state={state} onChange={set} />
      <SaveViewDialog open={saving} title="Save this view" error={saved && !saved.ok ? saved.msg : null} onSubmit={save} onClose={() => setSaving(false)} />
      <SearchChips q={state.q} search={data?.search} onChange={set} />
      <AppliedPills state={state} mode="flags" onChange={set} onReset={reset} />
      <StaleBanner scannedAt={scanned} />

      {error && !data ? (
        <ErrorState onRetry={sc.retry} what="best bets" />
      ) : !data ? (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]" aria-busy="true" aria-label="Loading best bets">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[300px]" />)}
        </div>
      ) : data.total === 0 ? (
        <EmptyState
          title="No best bets match these filters"
          line="Right now nothing with these filters is priced below how often similar bets have won. Clear the filters, or check back after the next scan."
          onReset={reset}
        />
      ) : (
        <>
          {error && <ErrorState onRetry={sc.retry} what="best bets" />}
          <PriceStrip f={data.facets} total={data.total} />
          <Cards rows={rows.slice(0, split)} desktop={desktop} pro={pro} dim={loading} first={state.sort.key === "roi"} />
          <BigPayouts state={state} pro={pro} />
          {tierOf(state) === "best" && <SuggestedCombos />}
          {rows.length > split && <Cards rows={rows.slice(split)} desktop={desktop} pro={pro} dim={loading} />}
          {rows.length < data.total && (
            <button
              type="button"
              onClick={sc.loadMore}
              disabled={sc.loadingMore}
              className="mx-auto min-h-11 rounded-input border border-border bg-surface px-5 text-sm hover:border-accent-border"
            >
              {sc.loadingMore ? "Loading…" : `Show more (${nf(data.total - rows.length)} left)`}
            </button>
          )}
          <MoreWithEdge state={state} desktop={desktop} pro={pro} />
          {!desktop && <p className="text-xs text-muted" title={RETURN_HELP}>Expected return: {RETURN_HELP}</p>}
        </>
      )}
    </div>
  );
}
