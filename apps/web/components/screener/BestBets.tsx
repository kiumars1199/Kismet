"use client";

// / "Best bets" (Hybrid artboard): title + stat tiles, filter pills + sort (docs/13 §2), card grid, price-check strip.
import { useEffect, useState } from "react";
import { fetchBacktest, type BacktestResponse, type MarketsResponse } from "@/lib/api";
import { RETURN_HELP, ago, ret } from "@/lib/format";
import { savePresetFromState } from "@/lib/presets";
import { useProfile } from "@/lib/repo/hooks";
import { TAXONOMY } from "@/lib/taxonomy";
import { BetCard } from "@/components/market/BetCard";
import { MarketCard } from "@/components/market/MarketCard";
import { SaveViewDialog } from "@/components/presets/SaveViewDialog";
import { Skeleton } from "@/components/market/bits";
import { FilterPills } from "@/components/search/FilterPills";
import { SearchChips } from "@/components/search/SearchChips";
import { AppliedPills } from "./AppliedPills";
import { EmptyState, ErrorState, StaleBanner } from "./States";
import { useDesktop } from "./useDesktop";
import { useMeta, useScreener } from "./useScreener";

const nf = (n: number) => n.toLocaleString("en-US");
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
  useEffect(() => void fetchBacktest().then(setBt, () => {}), []);
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
        <dd className="font-heading text-[30px] font-bold">{nf(t.flags)}</dd>
      </div>
    </dl>
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
            {data ? `${nf(data.total)} ${data.total === 1 ? "bet" : "bets"} where the odds lean your way` : "Bets where the odds lean your way"}
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
          {desktop ? (
            <ul className={`grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))] ${loading ? "opacity-60" : ""}`}>
              {rows.map((r, i) => (
                <li key={`${r.market.id}:${r.side.side_index}`} className="flex">
                  <BetCard r={r} highlight={i === 0 && state.sort.key === "roi"} help={i === 0} pro={pro} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className={`flex flex-col gap-2.5 ${loading ? "opacity-60" : ""}`}>
              {rows.map((r) => (
                <li key={`${r.market.id}:${r.side.side_index}`}><MarketCard r={r} pro={pro} /></li>
              ))}
            </ul>
          )}
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
          {!desktop && <p className="text-xs text-muted" title={RETURN_HELP}>Expected return: {RETURN_HELP}</p>}
        </>
      )}
    </div>
  );
}
