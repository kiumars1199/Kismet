"use client";

// /markets "All markets" (F-01): grouped rows on desktop, compact cards on mobile, URL-driven.
import { useEffect, useMemo, useState } from "react";
import { fetchEvent, groupRows, type ApiGroup, type ApiRow } from "@/lib/api";
import { pickSide, sideOk } from "@/lib/filters/apply";
import { defaultState } from "@/lib/filters/state";
import { ago } from "@/lib/format";
import { useProfile } from "@/lib/repo/hooks";
import { PresetBar } from "@/components/presets/PresetBar";
import { QuickChips } from "@/components/presets/QuickChips";
import { ExportCsv } from "@/components/presets/ExportCsv";
import { MarketCard } from "@/components/market/MarketCard";
import { Skeleton } from "@/components/market/bits";
import { SearchChips } from "@/components/search/SearchChips";
import { AppliedPills } from "./AppliedPills";
import { FilterPanel } from "./FilterPanel";
import { MarketTable, type Item } from "./MarketTable";
import { SortSelect } from "./SortSelect";
import { EmptyState, ErrorState, StaleBanner } from "./States";
import { useDesktop } from "./useDesktop";
import { useMeta, useScreener } from "./useScreener";

type Expanded = Record<string, { rows?: ApiRow[]; loading?: boolean }>;

export function MarketsScreener() {
  const sc = useScreener("markets");
  const { state, set, reset, data, loading, error } = sc;
  const meta = useMeta();
  const desktop = useDesktop();
  const pro = useProfile().numbers_mode === "pro";

  const [expanded, setExpanded] = useState<Expanded>({});
  useEffect(() => setExpanded({}), [data]);

  const toggle = async (g: ApiGroup) => {
    if (expanded[g.event_id]?.rows) return setExpanded(({ [g.event_id]: _, ...rest }) => rest);
    setExpanded((e) => ({ ...e, [g.event_id]: { loading: true } }));
    try {
      const ev = await fetchEvent(g.event_id);
      const shown = new Set(groupRows(data!, g).map((r) => r.market.id));
      const rows = ev.markets.flatMap((m) => {
        const side = pickSide(m, state.side);
        return !shown.has(m.id) && side && sideOk(side, state) ? [{ market: m, side }] : [];
      });
      setExpanded((e) => ({ ...e, [g.event_id]: { rows } }));
    } catch {
      setExpanded(({ [g.event_id]: _, ...rest }) => rest);
    }
  };

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    if (!data.groups) return data.rows.map((r) => ({ kind: "row", r }));
    return data.groups.flatMap((g) => {
      const ex = expanded[g.event_id];
      const out: Item[] = [{ kind: "group", g }, ...groupRows(data, g).map((r): Item => ({ kind: "row", r })), ...(ex?.rows ?? []).map((r): Item => ({ kind: "row", r }))];
      const hidden = g.size - g.count;
      if (hidden > 0) out.push({ kind: "more", g, hidden, expanded: !!ex?.rows, loading: ex?.loading });
      return out;
    });
  }, [data, expanded]);

  const scanned = meta?.meta.scanned_at;
  return (
    <div className="mx-auto flex w-full max-w-[1600px] gap-6">
      <FilterPanel state={state} mode="markets" facets={data?.facets} meta={meta} onChange={set} onReset={reset} />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">All markets</h1>
            <p className="mt-1 text-sm text-muted">
              {data ? `${data.total.toLocaleString("en-US")} ${data.total === 1 ? "market matches" : "markets match"}` : "Loading markets…"}
              {meta && ` · ${meta.counts.markets.toLocaleString("en-US")} open · scanned ${ago(scanned)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsv state={state} />
            <SortSelect sort={state.sort} onChange={(sort) => set({ sort })} />
          </div>
        </header>
        <PresetBar state={state} onChange={set} />
        <QuickChips state={state} onChange={set} />
        <SearchChips q={state.q} search={data?.search} onChange={set} />
        <AppliedPills state={state} mode="markets" onChange={set} onReset={reset} />
        <StaleBanner scannedAt={scanned} />

        {error && !data ? (
          <ErrorState onRetry={sc.retry} />
        ) : !data ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading markets">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : data.total === 0 ? (
          <EmptyState
            title={state.q ? "No matches in open markets" : "No markets match these filters"}
            line={state.q ? `Nothing open matches “${state.q}” with the filters you have on. Clear the filters to search every open market.` : "Every open market is hidden by at least one filter. Remove a filter above, or start over."}
            onReset={state.q ? () => set({ ...defaultState(), q: state.q }) : reset}
            resetLabel={state.q ? "Clear filters, keep search" : undefined}
          />
        ) : (
          <>
            {error && <ErrorState onRetry={sc.retry} />}
            {desktop ? (
              <MarketTable items={items} sort={state.sort} onSort={(sort) => set({ sort })} onToggleGroup={toggle} pro={pro} loading={loading} />
            ) : (
              <ul className={`flex flex-col gap-2.5 ${loading ? "opacity-60" : ""}`}>
                {items.map((it) =>
                  it.kind === "group" ? (
                    <li key={`g${it.g.event_id}`} className="px-1 pt-3 font-heading text-sm font-semibold text-soft">{it.g.event}</li>
                  ) : it.kind === "row" ? (
                    <li key={`${it.r.market.id}:${it.r.side.side_index}`}><MarketCard r={it.r} pro={pro} /></li>
                  ) : (
                    <li key={`m${it.g.event_id}`}>
                      <button type="button" onClick={() => toggle(it.g)} aria-expanded={it.expanded} className="min-h-11 px-1 text-[13px] text-accent-hover">
                        {it.loading ? "Loading…" : it.expanded ? "Show fewer" : `+${it.hidden} more in this event`}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
            <Pager page={data.page} pages={data.pages} onPage={(page) => set({ page })} />
          </>
        )}
      </div>
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = "min-h-11 rounded-input border border-border bg-surface px-4 hover:border-accent-border disabled:opacity-40 disabled:hover:border-border";
  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-3 py-2 text-sm">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="text-muted">Page {page} of {pages}</span>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}
