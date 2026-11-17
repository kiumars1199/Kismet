"use client";

// /flags "Best bets" (Hybrid artboard): title + stat tiles, topic chips, sort, card grid, price-check strip.
import { useEffect, useState } from "react";
import { fetchBacktest, type BacktestResponse, type MarketsResponse } from "@/lib/api";
import type { FilterState } from "@/lib/filters/state";
import { RETURN_HELP, ago, ret } from "@/lib/format";
import { savePresetFromState } from "@/lib/presets";
import { useProfile } from "@/lib/repo/hooks";
import { TAXONOMY } from "@/lib/taxonomy";
import { BetCard } from "@/components/market/BetCard";
import { MarketCard } from "@/components/market/MarketCard";
import { Skeleton } from "@/components/market/bits";
import { AppliedPills } from "./AppliedPills";
import { SORTS, SortSelect } from "./SortSelect";
import { EmptyState, ErrorState, StaleBanner } from "./States";
import { useDesktop } from "./useDesktop";
import { useMeta, useScreener } from "./useScreener";

const nf = (n: number) => n.toLocaleString("en-US");
const short = (label: string) => label.split(" & ")[0]!;

type Chip = { label: string; n: number; on: boolean; patch: Partial<FilterState> };

/** Leagues for sports, categories for the rest, biggest first (artboard: "Weather 286", "Soccer 197"). */
function topicChips(f: MarketsResponse["facets"], s: FilterState): Chip[] {
  const sports = Object.entries(f.topics).filter(([id, n]) => n > 0 && id.startsWith("sports.") && id.split(".").length === 2 && id !== "sports.other");
  const cats = Object.entries(f.categories).filter(([id, n]) => n > 0 && id !== "sports");
  return [
    ...sports.map(([id, n]) => ({ label: TAXONOMY[id]?.label ?? id, n, on: !!s.topics?.includes(id), patch: { topics: [id], categories: undefined } })),
    ...cats.map(([id, n]) => ({ label: short(TAXONOMY[id]?.label ?? id), n, on: !!s.categories?.includes(id as never), patch: { categories: [id as never], topics: undefined } })),
  ]
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
}

/** "Price check: 575 fair fill · 28 where the spread eats most of it · 1 hidden (price too high right now)". */
function PriceStrip({ f, total }: { f: MarketsResponse["facets"]; total: number }) {
  const v = f.verdicts;
  const cats = Object.entries(f.categories).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const parts = [
    v["worth it"] ? `${nf(v["worth it"])} fill at a fair price` : null,
    v.thin ? `${nf(v.thin)} where the spread eats most of the edge` : null,
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

const chip = (on: boolean) =>
  `min-h-10 rounded-full border px-3.5 text-[13px] ${on ? "border-accent-border bg-accent-bg text-accent-softer" : "border-border bg-surface text-soft hover:border-accent-border"}`;

export function BestBets() {
  const sc = useScreener("flags");
  const { state, set, reset, data, more, loading, error } = sc;
  const meta = useMeta();
  const desktop = useDesktop();
  const pro = useProfile().numbers_mode === "pro";
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "failed">("");

  const rows = data ? [...data.rows, ...more] : [];
  const chips = data ? topicChips(data.facets, state) : [];
  const anyTopic = !!(state.topics?.length || state.categories?.length);
  const today = state.closes_within_h === 24;
  const scanned = meta?.meta.scanned_at;

  const save = async () => {
    setSaved("saving");
    try {
      await savePresetFromState(state);
      setSaved("saved");
    } catch {
      setSaved("failed");
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

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&>*]:shrink-0">
        <button type="button" aria-pressed={!anyTopic} onClick={() => set({ topics: undefined, categories: undefined })} className={chip(!anyTopic)}>
          All topics
        </button>
        {chips.map((c) => (
          <button key={c.label} type="button" aria-pressed={c.on} onClick={() => set(c.on ? { topics: undefined, categories: undefined } : c.patch)} className={chip(c.on)}>
            {c.label} <span className="tabular-nums text-muted">{nf(c.n)}</span>
          </button>
        ))}
        <button type="button" aria-pressed={today} onClick={() => set({ closes_within_h: today ? undefined : 24 })} className={chip(today)}>
          Closes today
        </button>
        <button type="button" onClick={save} disabled={saved === "saving"} className={chip(false)}>
          {saved === "saved" ? "Saved ✓" : saved === "failed" ? "Couldn't save, try again" : "+ Save this view"}
        </button>
        <div className="ml-auto hidden md:block">
          <SortSelect sort={state.sort} onChange={(sort) => set({ sort })} options={SORTS.slice(0, 3)} />
        </div>
      </div>
      <div className="md:hidden">
        <SortSelect sort={state.sort} onChange={(sort) => set({ sort })} options={SORTS.slice(0, 3)} />
      </div>

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
