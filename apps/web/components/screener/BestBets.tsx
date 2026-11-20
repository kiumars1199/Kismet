"use client";

// / "Best bets", rebuilt for a casual bettor on a phone (docs/OVERHAUL.md §B, §G2; T-302):
//   title + one sentence · one chip row (top 6 sports + More, Today / This week, Safer / Balanced / Bigger payouts,
//   On Polymarket US, More filters) · "Today's top 5" · "More bets" · on Free, one locked card where the free list ends.
// No tier or section jargon, no stat tiles: every number's basis is inside each card's "Why this bet?" and on
// /track-record (one link here). R2-6: a filter change keeps the current list on screen, dimmed and marked busy,
// until the new one arrives (no skeleton flash). The old Big payouts / More bets with an edge / Combos rows, closing-soon
// strip and results ticker are gone: "Bigger payouts" is a chip (best bets that win less often), lower-confidence
// bets come in through a payout filter (tierOf), Combos has its own page, results are one link away.
import Link from "next/link";
import { useRef, useState } from "react";
import type { ApiGroup, ApiRow, MarketsResponse } from "@/lib/api";
import { cardVenue, plainTitle, priceText, sideLabel } from "@/lib/card";
import type { FilterState } from "@/lib/filters/state";
import { ago, formatCount } from "@/lib/format";
import { REFRESH_WORDS, freshness } from "@/lib/freshness";
import { savePresetFromState } from "@/lib/presets";
import { timeWindow } from "@/lib/search/parse";
import { TAXONOMY, TAXONOMY_TREE } from "@/lib/taxonomy";
import { BetCard } from "@/components/market/BetCard";
import { drawerHref, useOpenDrawer } from "@/components/market/drawer";
import { SaveViewDialog } from "@/components/presets/SaveViewDialog";
import { Count } from "@/components/kit";
import { CardSkeleton } from "@/components/market/bits";
import { SearchChips } from "@/components/search/SearchChips";
import { AppliedPills } from "./AppliedPills";
import { TodayCard } from "./DayStrip";
import { FilterPanel } from "./FilterPanel";
import { EmptyState, ErrorState, StaleBanner } from "./States";
import { useDesktop } from "./useDesktop";
import { LockedBets } from "./LockedBets";
import { queryFor, useMeta, useScreener } from "./useScreener";

const nf = formatCount;   // docs/18 §4: counts short, rounded down
const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const TOP = 5;
const H = 3_600_000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const SPORTS = (TAXONOMY_TREE.find((n) => n.id === "sports")?.children ?? []).map((n) => n.id);

/** 44px chip (R2: tap targets), the same look as the other pills. */
const chip = (on: boolean) =>
  `inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm ${
    on ? "border-accent-border bg-accent-bg text-accent-soft" : "border-border bg-surface text-soft hover:border-accent-border hover:text-text"
  }`;

/** One slot per game: the best bet in it plus the others (when grouped), or one slot per bet (flat). */
type Slot = { rows: ApiRow[]; size: number };
function slotsOf(rows: ApiRow[], groups: ApiGroup[] | undefined): Slot[] {
  if (!groups) return rows.map((r) => ({ rows: [r], size: 1 }));
  return groups.map((g) => ({ rows: rows.slice(g.start, g.start + g.count), size: g.size })).filter((s) => s.rows.length);
}

/** "+3 more in this game": the other bets in the same game, inline under the card (docs/17 fix 2), in card words. */
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
        <ul className="flex flex-col rounded-xl border border-border bg-surface px-3 py-1 text-[13px]">
          {others.map(({ market: m, side: s }) => (
            <li key={`${m.id}:${s.side_index}`} className="border-b border-border last:border-0">
              <a href={drawerHref(m.id, s.side_index)} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); openDrawer(m.id, s.side_index); }}
                className="flex min-h-11 flex-col justify-center py-2 hover:text-accent-hover">
                <span className="line-clamp-2">{plainTitle(m, s)}</span>
                <span className="text-xs text-muted">{sideLabel(s)} at {priceText(cardVenue(m, s).ask ?? s.ask)}</span>
              </a>
            </li>
          ))}
          {slot.size > slot.rows.length && (
            <li><a href={`/event/${ev.event_id}`} className="flex min-h-11 items-center text-accent-hover hover:text-accent-soft">All {nf(slot.size)} in this game</a></li>
          )}
        </ul>
      )}
    </div>
  );
}

function Cards({ slots, desktop, label }: { slots: Slot[]; desktop: boolean; label: string }) {
  return (
    <ul aria-labelledby={label} className={desktop ? GRID : "flex flex-col gap-3"}>
      {slots.map((s) => {
        const r = s.rows[0]!;
        return (
          // desktop: card and "+N more" sit in two subgrid rows, so a row of cards stays one height
          <li key={`${r.market.id}:${r.side.side_index}`} className={desktop ? "row-span-2 grid grid-rows-subgrid gap-y-1" : "flex flex-col gap-1"}>
            <BetCard r={r} />
            <MoreInGame slot={s} />
          </li>
        );
      })}
    </ul>
  );
}

type Change = (p: Partial<FilterState>, opts?: { replace?: boolean }) => void;

/** Closing windows in the viewer's timezone, stored as hours from the scan (what the data measures from); the same
 *  arithmetic as the Closes pill on All markets (components/search/FilterPills.tsx). */
function windowFor(kind: "today" | "week", scannedAt: number | undefined) {
  if (!scannedAt) return { closes_after_h: undefined, closes_within_h: kind === "today" ? 24 : 168 };
  const scan = scannedAt * 1000;
  const w = timeWindow(kind, Math.max(scan, Date.now()), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const after = (w.from - scan) / H;
  return { closes_after_h: after > 0.05 ? r2(after) : undefined, closes_within_h: r2((w.to - scan) / H) };
}

/** Win-chance bands, in plain words, cut where Best bets actually sit: nearly all win 60%+ of the time (real scan,
 *  Nov 20: 740 of 1,070 at 85%+, 268 at 70–85%, 62 under 70%). The default 40% floor stays on. */
const RISK: { key: string; label: string; patch: Pick<FilterState, "win_prob_min" | "win_prob_max">; help: string }[] = [
  { key: "safer", label: "Safer", patch: { win_prob_min: 0.85, win_prob_max: undefined }, help: "Won 85% of the time or more" },
  { key: "balanced", label: "Balanced", patch: { win_prob_min: 0.7, win_prob_max: 0.85 }, help: "Won 70–85% of the time" },
  { key: "bigger", label: "Bigger payouts", patch: { win_prob_min: undefined, win_prob_max: 0.7 }, help: "Pays more, loses more often: won under 70% of the time" },
];

/** Which chips are pressed. A time chip matches on the window's end, within 15 minutes: the window is measured from
 *  the scan and recomputed from the clock, so an exact match would un-press it a minute later. */
function chipsFor(s: FilterState, facets: MarketsResponse["facets"] | undefined, scannedAt: number | undefined) {
  const chosen = s.topics ?? [];
  const sports = [...new Set([...chosen.filter((id) => SPORTS.includes(id)), ...SPORTS.filter((id) => (facets?.topics[id] ?? 0) > 0)
    .sort((a, b) => (facets?.topics[b] ?? 0) - (facets?.topics[a] ?? 0))])].slice(0, 6);
  const today = windowFor("today", scannedAt);
  const week = windowFor("week", scannedAt);
  const near = (w: typeof today) => s.closes_within_h !== undefined && Math.abs(s.closes_within_h - w.closes_within_h) <= 0.25;
  const time = { today: near(today), week: !near(today) && near(week) };
  const risk = RISK.find((r) => s.win_prob_min === r.patch.win_prob_min && s.win_prob_max === r.patch.win_prob_max)?.key;
  return { chosen, sports, today, week, time, risk };
}

function ChipRow({ state: s, facets, scannedAt, usOn, onChange, children }: {
  state: FilterState; facets?: MarketsResponse["facets"]; scannedAt?: number; usOn: boolean; onChange: Change; children?: React.ReactNode;
}) {
  const c = chipsFor(s, facets, scannedAt);
  const { chosen, sports } = c;
  return (
    <div role="group" aria-label="Quick filters" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      {sports.map((id) => {
        const on = chosen.includes(id);
        return (
          <button key={id} type="button" aria-pressed={on} className={chip(on)}
            onClick={() => onChange({ topics: on ? (chosen.filter((x) => x !== id).length ? chosen.filter((x) => x !== id) : undefined) : [id], categories: undefined })}>
            {TAXONOMY[id]?.label ?? id}
          </button>
        );
      })}
      <button type="button" className={chip(chosen.some((id) => !sports.includes(id)) || !!s.categories?.length)}
        onClick={() => window.dispatchEvent(new Event("me:toggle-filters"))}>
        More sports
      </button>
      <span aria-hidden="true" className="mx-1 h-6 w-px flex-none bg-border" />
      {([["Today", "today"], ["This week", "week"]] as const).map(([label, k]) => {
        const on = c.time[k];
        return (
          <button key={label} type="button" aria-pressed={on} className={chip(on)} suppressHydrationWarning
            onClick={() => onChange(on ? { closes_after_h: undefined, closes_within_h: undefined } : c[k])}>
            {label}
          </button>
        );
      })}
      <span aria-hidden="true" className="mx-1 h-6 w-px flex-none bg-border" />
      {RISK.map((r) => {
        const on = c.risk === r.key;
        return (
          <button key={r.key} type="button" aria-pressed={on} title={r.help} className={chip(on)}
            onClick={() => onChange(on ? { win_prob_min: undefined, win_prob_max: undefined } : r.patch)}>
            {r.label}
          </button>
        );
      })}
      {usOn && (
        <>
          <span aria-hidden="true" className="mx-1 h-6 w-px flex-none bg-border" />
          <button type="button" aria-pressed={s.us} data-testid="us-chip" className={chip(s.us)}
            title="Only bets you can place on Polymarket US, at its price and fee"
            onClick={() => onChange({ us: !s.us })}>
            {s.us && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
            On Polymarket US
          </button>
        </>
      )}
      {children}
    </div>
  );
}

/** AppliedPills leaves out a filter only while a pressed chip already shows it (keys: components/screener/AppliedPills.tsx).
 *  Anything set in the sheet, a saved view or a shared link with no pressed chip keeps its removable pill. */
function chipPills(s: FilterState, facets: MarketsResponse["facets"] | undefined, scannedAt: number | undefined) {
  const c = chipsFor(s, facets, scannedAt);
  const shownTopics = new Set(c.sports.filter((id) => c.chosen.includes(id)));
  return (key: string) =>
    (key.startsWith("topics:") && shownTopics.has(key.slice(7))) ||
    (!!c.risk && (key === "wp" || key === "wp1")) ||
    ((c.time.today || c.time.week) && (key === "cw" || key === "ca"));
}

/** initial: the server's /api/flags page 1 for this URL, so the cards and the headline count are final on first
 *  paint (no client fetch, no LCP change). */
export function BestBets({ initial }: { initial?: { main: MarketsResponse; soon?: MarketsResponse; scanned_at?: number } }) {
  const sc = useScreener("flags", initial?.main);
  const { state, set, reset, error } = sc;
  const meta = useMeta();
  const desktop = useDesktop();
  // R2-6: keep the last answer on screen while the next one loads (dimmed, aria-busy), never a skeleton flash.
  const fresh = sc.data ? { data: sc.data, more: sc.more, moreGroups: sc.moreGroups } : null;
  const last = useRef(fresh);   // the last answer shown; a ref, so keeping it never re-renders
  if (fresh) last.current = fresh;
  const view = fresh ?? (sc.loading ? last.current : null);
  const data = view?.data;
  const busy = !fresh && !!view;
  const total = data?.total;
  // Free: the day's sample, then one locked card (docs/19 P3). Read from the server's answer (free_daily), never from
  // the client's tier: that is "free" until /api/me answers, which painted a paid page as "Free shows 89 …" (T-288).
  const daily = data?.free_daily;
  const sample = daily !== undefined;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ ok: boolean; msg: string } | null>(null);

  const rows = data ? [...data.rows, ...view!.more] : [];
  const slots = data ? slotsOf(rows, data.groups ? [...data.groups, ...view!.moreGroups] : undefined) : [];
  const left = data ? (data.total_groups ?? data.total) - slots.length : 0;
  const scanned = meta?.meta.scanned_at ?? initial?.scanned_at;   // server value first: the stale banner paints with the cards
  // §G2: the "On Polymarket US" chip exists once the scan carries US quotes (older scans: the filter is a no-op)
  const usOn = meta ? meta.meta.us?.ok === true : rows.some((r) => !!r.market.us);
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
          {/* P9: Free sees the day's sample, so the headline says "10 of 34", not a count it can't open */}
          {total !== undefined
            ? <>{sample && rows.length < total ? <>{rows.length} of </> : null}<Count n={total} /> {total === 1 ? "bet" : "bets"} where the odds lean your way</>
            : "Bets where the odds lean your way"}
        </h1>
        <p className="max-w-[760px] text-sm leading-normal text-muted">
          Each one has won more often in the past than its price suggests, after the fee.
          {/* P9: when the stale banner shows, it carries the scan age; saying it here too was the third stale notice */}
          {scanned && freshness(scanned) === "fresh" && <span suppressHydrationWarning className="whitespace-nowrap"> Updated {ago(scanned)}.</span>}{" "}
          <Link href="/track-record" className="inline-flex min-h-11 items-center text-accent-hover underline-offset-4 hover:underline">See how we track results</Link>
        </p>
      </section>

      <TodayCard />

      <ChipRow state={state} facets={sc.facets} scannedAt={scanned} usOn={usOn} onChange={set}>
        <FilterPanel state={state} mode="flags" facets={sc.facets} meta={meta} onChange={set} onReset={reset} />
        <button type="button" onClick={() => (setSaved(null), setSaving(true))} className="inline-flex min-h-11 flex-none items-center whitespace-nowrap px-2 text-[13px] text-muted hover:text-text">+ Save this view</button>
        <span role="status" className="text-[13px] text-accent-softer empty:hidden">{saved?.ok ? saved.msg : ""}</span>
      </ChipRow>
      <SaveViewDialog open={saving} title="Save this view" error={saved && !saved.ok ? saved.msg : null} onSubmit={save} onClose={() => setSaving(false)} />
      <SearchChips q={state.q} search={data?.search} onChange={set} />
      <AppliedPills state={state} mode="flags" onChange={set} onReset={reset} omit={chipPills(state, sc.facets, scanned)} />
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
          line={`No bet with these filters is good value right now${state.us && usOn ? " on Polymarket US" : ""}. Prices refresh ${REFRESH_WORDS}.`}
          onReset={reset}
          link={state.us && usOn
            ? { href: "/" + queryFor({ ...state, us: false, page: 1 }, "flags"), label: "Include international bets" }
            : { href: "/markets", label: "Look in All markets" }}
        />
      ) : (
        <div data-testid="bets-list" aria-busy={busy} className={`flex flex-col gap-4 transition-opacity duration-200 ease-out ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy && <p role="status" className="sr-only">Updating best bets</p>}
          {error && <ErrorState onRetry={sc.retry} what="best bets" error={error} />}
          <h2 id="top-h" className="text-xl font-semibold">Today&apos;s top {Math.min(TOP, slots.length)}</h2>
          <Cards slots={slots.slice(0, TOP)} desktop={desktop} label="top-h" />
          {slots.length > TOP && (
            <>
              <h2 id="more-h" className="mt-2 text-xl font-semibold">More bets</h2>
              <Cards slots={slots.slice(TOP)} desktop={desktop} label="more-h" />
            </>
          )}
          {sample && <LockedBets total={data.total} shown={rows.length} daily={daily} />}
          {!sample && left > 0 && (
            <button
              type="button"
              onClick={sc.loadMore}
              disabled={sc.loadingMore}
              className="mx-auto min-h-11 rounded-xl border border-border bg-surface px-5 text-sm hover:border-accent-border"
            >
              {sc.loadingMore ? "Loading…" : `Show more (${nf(left)} left)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
