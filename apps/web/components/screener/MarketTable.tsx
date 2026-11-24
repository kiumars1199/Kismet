"use client";

// Desktop rows (F-01): TanStack Table for columns + visibility, TanStack Virtual over the window for rows.
// Sorting is server-side (manualSorting): a header click asks the page to change `sort` in the URL.
import { BREAKPOINTS, COL_CLASS, minWidthAt } from "@/lib/market-table-cols";
import { ClosesIn, ClosesLine } from "@/components/clock";
import Link from "next/link";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ApiGroup, ApiRow } from "@/lib/api";
import type { SortKey } from "@/lib/filters/state";
import type { FilterState } from "@/lib/filters/state";
import { basis, DASH, edge, money, pct, price, RETURN_HELP, sideEdge, formatCount, cleanEventLine } from "@/lib/format";
import { WatchStar } from "@/components/watch/WatchStar";
import { checkHref } from "@/lib/check/href";
import { drawerHref, useOpenDrawer } from "@/components/market/drawer";
import { AlertLink, Notes, Val } from "@/components/market/bits";
import { VenueIconLink } from "@/components/trade/TradeButton";
import { VERDICT_LABEL, chanceTone, returnTone, rowNotes, topicLabel } from "@/components/market/labels";
import { betFigures, betQuote, PAYS_AFTER_FEE_HELP } from "@/lib/betFigures";

export type Item =
  | { kind: "group"; g: ApiGroup }
  | { kind: "row"; r: ApiRow }
  | { kind: "more"; g: ApiGroup; hidden: number; expanded: boolean; loading?: boolean };

type Col = ColumnDef<ApiRow, unknown> & { meta?: { sort?: SortKey; pro?: boolean; label: string; right?: boolean; help?: string } };
const h = createColumnHelper<ApiRow>();
const LEVEL = { all: "All markets", cat: "Category", niche: "Niche", nmt: "Niche + type" } as const;
const num = (x: number | null | undefined, f: (n: number) => string) => (typeof x === "number" && Number.isFinite(x) ? f(x) : DASH);
const usd = (x: number | null | undefined) => num(x, (n) => money(n));

function columns(pro: boolean): Col[] {
  return [
    h.display({ id: "star", header: () => <span className="sr-only">Save</span>, cell: ({ row: { original: r } }) => <WatchStar marketId={r.market.id} side={r.side.side_index} market={r.market} />, meta: { label: "Save" } }),
    h.display({
      id: "market", meta: { label: "Market" },
      header: "Market",
      cell: ({ row: { original: r } }) => <MarketCell r={r} />,
    }),
    h.display({ id: "bet", header: "Bet", meta: { label: "Bet" }, cell: ({ row: { original: r } }) => {
      const q = betQuote(r.market, r.side);
      // No separator before "pays": the muted extra-small "pays 1.47x" sets the halves apart. The two halves wrap onto two lines only when
      // the table is squeezed (1280 px, any font).
      return (
        <span data-testid="bet-cell" className="font-medium">
          <span data-testid="bet-side" className="whitespace-nowrap">{r.side.outcome} · {pct(q.ask)}</span>{" "}
          <span data-testid="bet-pays" className="whitespace-nowrap text-xs font-normal tabular-nums text-muted" title={PAYS_AFTER_FEE_HELP}>pays {q.paysText ?? DASH}</span>
        </span>
      );
    } }),
    h.display({
      id: "return", meta: { label: pro ? "Edge" : "Estimated return", sort: pro ? "edge" : "roi", right: true, help: RETURN_HELP },
      header: pro ? "Edge" : "Estimated return",
      cell: ({ row: { original: r } }) => pro
        ? <Val v={sideEdge(r.side)} className={`font-heading text-base ${returnTone(r.side.roi_pct)}`} title={basis(r.market, r.side)} />
        : (() => { const q = betQuote(r.market, r.side); return <Val v={q.retText} className={`font-heading text-base ${returnTone(q.roi)}`} title={q.math ?? basis(r.market, r.side)} />; })(),
    }),
    h.display({ id: "won", header: "Won before", meta: { label: "Won before", sort: "win_prob", right: true }, cell: ({ row: { original: r } }) => <Val v={pct(r.side.win_prob)} className="text-accent-soft" title={basis(r.market, r.side)} /> }),
    h.display({ id: "says", header: "Market says", meta: { label: "Market says", sort: "price", right: true }, cell: ({ row: { original: r } }) => <Val v={pct(betQuote(r.market, r.side).ask)} /> }),
    h.display({
      id: "chance", header: "Chance", meta: { label: "Chance" },
      cell: ({ row: { original: r } }) => { const c = betFigures(r.side, { market: r.market }).chance; return <span className={`whitespace-nowrap ${chanceTone(c)}`}>{c ?? <Val v={DASH} />}</span>; },
    }),
    h.display({ id: "closes", header: "Closes", meta: { label: "Closes", sort: "closes", right: true }, cell: ({ row: { original: r } }) => <span className="whitespace-nowrap"><ClosesIn at={r.market.closes_at} /></span> }),
    h.display({ id: "topic", header: "Topic", meta: { label: "Topic" }, cell: ({ row: { original: r } }) => <span className="text-xs text-muted">{topicLabel(r.market)}</span> }),
    // optional Pro columns (hidden by default)
    h.display({ id: "mid", header: "Mid", meta: { label: "Mid", pro: true, right: true }, cell: ({ row: { original: r } }) => <Val v={price(r.side.mid)} /> }),
    h.display({ id: "spread", header: "Spread", meta: { label: "Spread", pro: true, sort: "spread", right: true }, cell: ({ row: { original: r } }) => <Val v={price(r.market.spread)} /> }),
    h.display({ id: "fee", header: "Fee", meta: { label: "Fee", pro: true, right: true }, cell: ({ row: { original: r } }) => <Val v={price(r.side.fee)} /> }),
    h.display({ id: "volume", header: "Volume", meta: { label: "Volume", pro: true, sort: "volume", right: true }, cell: ({ row: { original: r } }) => <Val v={usd(r.market.volume)} /> }),
    h.display({ id: "volume_24h", header: "24h volume", meta: { label: "24h volume", pro: true, sort: "volume_24h", right: true }, cell: ({ row: { original: r } }) => <Val v={usd(r.market.volume_24h)} /> }),
    h.display({ id: "liquidity", header: "Liquidity", meta: { label: "Liquidity", pro: true, sort: "liquidity", right: true }, cell: ({ row: { original: r } }) => <Val v={usd(r.market.liquidity)} /> }),
    h.display({ id: "evidence", header: "Evidence", meta: { label: "Evidence (events)", pro: true, sort: "evidence", right: true }, cell: ({ row: { original: r } }) => <Val v={num(r.side.model_events, formatCount)} title={basis(r.market, r.side)} /> }),
    h.display({ id: "level", header: "Model level", meta: { label: "Model level", pro: true }, cell: ({ row: { original: r } }) => <span className="whitespace-nowrap">{LEVEL[r.side.model_level] ?? r.side.model_level}</span> }),
    h.display({ id: "type", header: "Market type", meta: { label: "Market type", pro: true }, cell: ({ row: { original: r } }) => <span className="whitespace-nowrap">{r.market.market_type}</span> }),
    h.display({ id: "retention", header: "Retention", meta: { label: "Retention", pro: true, sort: "retention", right: true }, cell: ({ row: { original: r } }) => <Val v={pct(r.market.execution?.retention)} /> }),
    h.display({ id: "capacity", header: "Capacity", meta: { label: "Capacity", pro: true, sort: "capacity", right: true }, cell: ({ row: { original: r } }) => <Val v={usd(r.market.execution?.capacity_usd)} /> }),
    h.display({ id: "verdict", header: "Price check", meta: { label: "Price check", pro: true }, cell: ({ row: { original: r } }) => { const v = r.market.execution?.verdict; return <Val v={v ? VERDICT_LABEL[v] : DASH} className="whitespace-nowrap" />; } }),
    h.display({ id: "realistic", header: "Realistic edge", meta: { label: "Realistic edge", pro: true, sort: "realistic_edge", right: true }, cell: ({ row: { original: r } }) => <Val v={edge(r.side.realistic_edge)} /> }),
    h.display({ id: "alert", header: () => <span className="sr-only">Alert me</span>, meta: { label: "Alert me" }, cell: ({ row: { original: r } }) => <span className="flex"><Link href={checkHref(r.market.id, r.side.side_index)} data-testid="check-link" aria-label={`Check this bet: ${r.market.question}`} className="flex min-h-11 items-center px-2 text-xs font-semibold text-accent-hover hover:text-accent-soft">Check</Link><VenueIconLink m={r.market} /><AlertLink marketId={r.market.id} side={r.side.side_index} /></span> }),
  ] as Col[];
}

function MarketCell({ r }: { r: ApiRow }) {
  const { open } = useOpenDrawer();
  return (
    <div className="min-w-0">
      <a
        href={drawerHref(r.market.id, r.side.side_index)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.metaKey || e.ctrlKey) window.open(r.market.url, "_blank", "noopener,noreferrer");
          else open(r.market.id, r.side.side_index);
        }}
        className="line-clamp-2 min-h-11 font-medium leading-[22px] text-text hover:text-accent-hover"   /* 2 x 22 px = the 44 px tap target, so no sliver of a 3rd line shows under the clamp */
      >
        {r.market.question}
      </a>
      <Notes notes={rowNotes(r.market.execution)} className="mt-1" />
    </div>
  );
}

const colW = (id: string) => COL_CLASS[id] ?? "w-[100px]";   // Market: "" (the flexible column)

const COLS_KEY = "me.columns.v1";
const PRO_IDS = ["mid", "spread", "fee", "volume", "volume_24h", "liquidity", "evidence", "level", "type", "retention", "capacity", "verdict", "realistic"];
const hiddenPro = (): VisibilityState => Object.fromEntries(PRO_IDS.map((id) => [id, false]));

/** Visible columns, remembered per browser. */
function useColumnVisibility() {
  const [vis, setVis] = useState<VisibilityState>(hiddenPro);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLS_KEY);
      if (saved) setVis({ ...hiddenPro(), ...JSON.parse(saved) });
    } catch {}
  }, []);
  const update = (v: VisibilityState) => {
    setVis(v);
    try { localStorage.setItem(COLS_KEY, JSON.stringify(v)); } catch {}
  };
  return [vis, update] as const;
}

export function MarketTable({ items, sort, onSort, onToggleGroup, pro = false, loading = false }: {
  items: Item[];
  sort: FilterState["sort"];
  onSort: (s: FilterState["sort"]) => void;
  onToggleGroup?: (g: ApiGroup) => void;
  pro?: boolean;
  loading?: boolean;
}) {
  const cols = useMemo(() => columns(pro), [pro]);
  const [vis, setVis] = useColumnVisibility();
  const rows = useMemo(() => items.flatMap((i) => (i.kind === "row" ? [i.r] : [])), [items]);
  const table = useReactTable({
    data: rows, columns: cols, getCoreRowModel: getCoreRowModel(), manualSorting: true,
    state: { columnVisibility: vis },
    onColumnVisibilityChange: (u) => setVis(typeof u === "function" ? u(vis) : u),
    getRowId: (r) => `${r.market.id}:${r.side.side_index}`,
  });
  const byId = new Map(table.getRowModel().rows.map((r) => [r.id, r]));
  const visible = table.getVisibleLeafColumns();

  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => setMargin(bodyRef.current ? bodyRef.current.getBoundingClientRect().top + window.scrollY : 0), []);
  const v = useWindowVirtualizer({
    count: items.length,
    estimateSize: (i) => (items[i]!.kind === "row" ? 64 : 44),
    overscan: 12,
    scrollMargin: margin,
  });
  const virtual = v.getVirtualItems();
  const top = virtual.length ? virtual[0]!.start - margin : 0;
  // Before the window is measured (server HTML, first hydration) no row is virtual yet: reserve the table's estimated height,
  // so the pager and footer don't jump from the first paint to the measured one (CLS, F3 review).
  const bottom = virtual.length ? v.getTotalSize() - (virtual.at(-1)!.end - margin) : v.getTotalSize();

  // When the table scrolls inside its own box (below xl, or wider than the box with extra columns): a fade on the right edge says more columns are off to the right. It is an overlay
  // (absolute, no layout), so it can never shift the page.
  const boxRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, []);

  const sortBy = (key?: SortKey) => {
    if (!key) return;
    const dir = sort.key === key ? (sort.dir === "desc" ? "asc" : "desc") : key === "closes" || key === "price" ? "asc" : "desc";
    onSort({ key, dir });
  };

  return (
    // The table is about 1250 px wide at its narrowest (tighter column padding from xl): below 1280 px it scrolls inside its own box,
    // never the page. From 1280 px, when it fits (`more` false), the box doesn't scroll and the sticky header keeps working; with extra
    // columns it doesn't fit, so the box scrolls at every width. `more` is the same under overflow-visible (scrollWidth still counts
    // the overflowing content), so the class cannot flip-flop.
    <div className="relative rounded-card border border-border bg-surface">
      <div ref={boxRef} className={more ? "overflow-x-auto" : "overflow-x-auto xl:overflow-visible"}>
      <table
        className={`w-full min-w-(--mw-0) min-[1366px]:min-w-(--mw-1366) min-[1440px]:min-w-(--mw-1440) table-fixed border-collapse text-sm ${loading ? "opacity-60" : ""}`}
        // one min-width per breakpoint, from the same widths that render (a single base sum let Bet and Topic eat Market's floor from 1440 px)
        style={Object.fromEntries(BREAKPOINTS.map((bp) => [`--mw-${bp}`, `${minWidthAt(visible.map((c) => c.id), bp)}px`])) as React.CSSProperties}
        aria-busy={loading}>
        {/* Page-sticky (under the 64 px top bar) only where the box does not scroll: from xl, when the columns fit. In a scrolling box (below xl, or
            with extra columns) the box is the sticky container, so top-16 would leave a 64 px blank band over the first row. */}
        <thead className={`sticky top-0 z-10 bg-surface ${more ? "" : "xl:top-16"}`}>
          <tr className="border-b border-border text-left text-xs text-muted">
            {table.getHeaderGroups()[0]!.headers.map((hd) => {
              const meta = (hd.column.columnDef as Col).meta;
              const active = meta?.sort && sort.key === meta.sort;
              return (
                <th
                  key={hd.id}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={`px-3 py-2.5 font-medium xl:px-2 ${meta?.right ? "text-right" : ""} ${colW(hd.id)}`}
                >
                  {hd.id === "star" ? (
                    <ColumnChooser cols={table.getAllLeafColumns().map((c) => ({ id: c.id, label: (c.columnDef as Col).meta?.label ?? c.id, pro: !!(c.columnDef as Col).meta?.pro, on: c.getIsVisible(), toggle: () => c.toggleVisibility() }))} />
                  ) : meta?.sort ? (
                    <button type="button" onClick={() => sortBy(meta.sort)} title={meta.help} className={`inline-flex min-h-11 -my-2 items-center gap-1 whitespace-nowrap hover:text-text ${active ? "text-text" : ""}`}>
                      {flexRender(hd.column.columnDef.header, hd.getContext())}
                      <span aria-hidden="true" className={active ? "text-accent" : "opacity-40"}>{active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
                    </button>
                  ) : (
                    flexRender(hd.column.columnDef.header, hd.getContext())
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={bodyRef}>
          {top > 0 && <tr aria-hidden="true" style={{ height: top }} />}
          {virtual.map((vi) => {
            const it = items[vi.index]!;
            if (it.kind === "group")
              return (
                <tr key={vi.key} data-index={vi.index} ref={v.measureElement} className="border-t border-border bg-background/40">
                  <td colSpan={visible.length} className="px-3 pb-1.5 pt-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link href={`/event/${it.g.event_id}`} className="font-heading text-[15px] font-semibold hover:text-accent-hover">{cleanEventLine(it.g.event)}</Link>
                      <span className="text-xs text-muted"><ClosesLine at={it.g.closes_at} cap /></span>
                      {it.g.flagged > 0 && <span className="text-xs text-accent-softer">{it.g.flagged} best {it.g.flagged === 1 ? "bet" : "bets"}</span>}
                    </div>
                  </td>
                </tr>
              );
            if (it.kind === "more")
              return (
                <tr key={vi.key} data-index={vi.index} ref={v.measureElement}>
                  <td colSpan={visible.length} className="px-3 py-1">
                    <button type="button" onClick={() => onToggleGroup?.(it.g)} aria-expanded={it.expanded} className="min-h-11 text-xs text-accent-hover hover:text-accent-soft">
                      {it.loading ? "Loading…" : it.expanded ? "Show fewer" : `+${formatCount(it.hidden)} more in this event`}
                    </button>
                  </td>
                </tr>
              );
            const row = byId.get(`${it.r.market.id}:${it.r.side.side_index}`);
            if (!row) return null;
            return (
              <tr
                key={vi.key}
                data-row
                data-market-id={it.r.market.id}
                data-index={vi.index}
                ref={v.measureElement}
                className="cursor-pointer border-t border-border/60 hover:bg-raised"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button,input")) return;
                  (e.currentTarget.querySelector("td a") as HTMLAnchorElement | null)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: e.metaKey, ctrlKey: e.ctrlKey }));
                }}
              >
                {row.getVisibleCells().map((c) => {
                  const meta = (c.column.columnDef as Col).meta;
                  return (
                    <td key={c.id} className={`px-3 py-1 align-middle tabular-nums xl:px-2 ${meta?.right ? "text-right" : ""}`}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {bottom > 0 && <tr aria-hidden="true" style={{ height: bottom }} />}
        </tbody>
      </table>
      </div>
      <div aria-hidden="true" data-testid="table-fade" data-on={more ? "true" : "false"} className={`pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-card bg-gradient-to-l from-surface to-transparent transition-opacity ${more ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}

function ColumnChooser({ cols }: { cols: { id: string; label: string; pro: boolean; on: boolean; toggle: () => void }[] }) {
  const pick = cols.filter((c) => c.id !== "market" && c.id !== "star");
  // The menu fits the visible screen wherever it is opened. From the top of the page it ran ~500 px past the bottom; capping it at the room
  // under the button fixed that, but on a short screen (1280x720, button ~64 px above the bottom) the cap left nothing. So it opens upward when
  // the room above (under the 64 px top bar) is bigger, and is capped at the room on its side either way. Measured on open and again while the
  // page scrolls or resizes; the rows scroll inside.
  const root = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [fit, setFit] = useState<{ up: boolean; room: number } | undefined>();
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const b = root.current?.querySelector("summary")?.getBoundingClientRect();
      if (!b) return;
      const below = Math.floor(window.innerHeight - b.bottom - 12), above = Math.floor(b.top - 72);
      const up = below < 260 && above > below;
      setFit({ up, room: Math.max(120, up ? above : below) });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [open]);
  return (
    <details ref={root} className="relative" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary title="Choose columns" className="-my-1 flex size-11 cursor-pointer list-none items-center justify-center rounded-input text-muted hover:bg-muted-bg hover:text-text">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        <span className="sr-only">Choose columns</span>
      </summary>
      <div style={fit ? { maxHeight: fit.room } : undefined} className={`absolute left-0 z-20 ${fit?.up ? "bottom-full mb-1" : "mt-1"} max-h-[calc(100svh-9rem)] w-64 overflow-y-auto overscroll-contain rounded-input border border-border bg-raised p-3 text-sm`}>
        <fieldset>
          <legend className="mb-1 text-xs text-muted">Main</legend>
          {pick.filter((c) => !c.pro).map((c) => <Check key={c.id} {...c} />)}
        </fieldset>
        <fieldset className="mt-3">
          <legend className="mb-1 text-xs text-muted">Details for pros</legend>
          {pick.filter((c) => c.pro).map((c) => <Check key={c.id} {...c} />)}
        </fieldset>
      </div>
    </details>
  );
}

function Check({ label, on, toggle }: { label: string; on: boolean; toggle: () => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-soft">
      <input type="checkbox" checked={on} onChange={toggle} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}
