"use client";
// Best bets filter bar, Mark's layout (Nov 20): three dropdowns (Sport, Multiplier, Date) and Apply, then the count
// and Sort. Patterned on the sites the owners rank most usable (Google Flights, Airbnb, Kalshi): few controls, plain
// labels, one obvious button. Native <select>s, so phones get their own picker. The draft only reaches the URL on
// Apply, so picking three values starts one load, not three (#45: no half-filtered list in between).
import { useEffect, useMemo, useState } from "react";
import type { MarketsResponse } from "@/lib/api";
import type { FilterState } from "@/lib/filters/state";
import { SortNote } from "./SortNote";
import { TAXONOMY, TAXONOMY_TREE } from "@/lib/taxonomy";
import { formatCount, plural } from "@/lib/format";
import { useProfile } from "@/lib/repo/hooks";

type Change = (p: Partial<FilterState>, opts?: { replace?: boolean }) => void;
type Win = { closes_after_h: number | undefined; closes_within_h: number };

/** Every category and its topics, always listed (Marc, Nov 22: tennis, cricket, politics, stocks, culture must be
 *  pickable even when they have no best bets right now; the count says so). "Other" buckets are left out. */
const GROUPS = TAXONOMY_TREE.filter((n) => n.id !== "other").map((n) => ({
  id: n.id, label: n.label, topics: (n.children ?? []).filter((c) => !c.id.endsWith(".other")).map((c) => ({ id: c.id, label: c.label })),
}));

/** Local calendar day "YYYY-MM-DD" <-> unix s at its start / end, in the visitor's own time zone. */
export const dayStart = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y!, m! - 1, dd!).getTime() / 1000; };
export const dayEnd = (d: string) => dayStart(d) + 86400 - 1;
export const dayOf = (unix: number) => { const t = new Date(unix * 1000); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

export const MULTIPLIERS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "lt1.5", label: "Under 1.5x", max: 1.5 },
  { key: "1.5-2", label: "1.5x–2x", min: 1.5, max: 2 },
  { key: "2-3", label: "2x–3x", min: 2, max: 3 },
  { key: "3-5", label: "3x–5x", min: 3, max: 5 },
  { key: "5+", label: "5x or more", min: 5 },
];
export const SORTS: { key: string; label: string; sort: FilterState["sort"] }[] = [
  { key: "roi", label: "Best value", sort: { key: "roi", dir: "desc" } },
  { key: "win_prob", label: "Most likely to win", sort: { key: "win_prob", dir: "desc" } },
  { key: "pays", label: "Biggest payout", sort: { key: "pays", dir: "desc" } },
  { key: "closes", label: "Closing soonest", sort: { key: "closes", dir: "asc" } },
];

/** Sport value when 2+ topics filter the list (saved "Your topics"): shown as "Your topics (N)", left as they are on Apply. */
export const MULTI = "multi";
/** The multi option's label: "Your topics (N)" only for the saved topics (fav=1); a hand-picked set is just "N topics". */
export const multiLabel = (s: Pick<FilterState, "topics" | "favorites_only">) => { const n = s.topics?.length ?? 0; return s.favorites_only ? `Your topics (${n})` : `${n} topics`; };
type Bar = { sport: string; mult: string; date: string; from: string; to: string };

/** The bar's values read from a FilterState ("" = any). date "custom" = the From/To days below. */
export function barValues(s: FilterState, win: { today: Win; week: Win }): Bar {
  const sport = s.topics?.length === 1 ? `t:${s.topics[0]}` : (s.topics?.length ?? 0) > 1 ? MULTI : s.categories?.length === 1 && !s.topics?.length ? `c:${s.categories[0]}` : "";
  const mult = MULTIPLIERS.find((m) => m.min === s.pays_min && m.max === s.pays_max)?.key ?? "";
  const near = (w: Win) => s.closes_within_h !== undefined && Math.abs(s.closes_within_h - w.closes_within_h) <= 0.25;
  const custom = s.closes_from !== undefined || s.closes_to !== undefined;
  const date = custom ? "custom" : near(win.today) ? "today" : near(win.week) ? "week" : "";
  const from = s.closes_from !== undefined ? dayOf(s.closes_from) : "";
  const to = s.closes_to !== undefined ? dayOf(s.closes_to) : "";
  return { sport, mult, date, from, to };
}

/** The FilterState patch for three bar values. */
export function barPatch(v: Bar, win: { today: Win; week: Win }): Partial<FilterState> {
  const m = MULTIPLIERS.find((x) => x.key === v.mult);
  const w = v.date === "today" ? win.today : v.date === "week" ? win.week : null;
  // Airline-style range: one day picked = that day only; To before From is swapped.
  const [a, b] = [v.from, v.to || v.from].sort();
  const custom = v.date === "custom" && !!a;
  return {
    closes_from: custom ? dayStart(a!) : undefined, closes_to: custom ? dayEnd(b!) : undefined,
    ...(v.sport === MULTI ? {} : {
      topics: v.sport.startsWith("t:") ? [v.sport.slice(2)] : undefined,
      categories: v.sport.startsWith("c:") ? [v.sport.slice(2) as never] : undefined,
    }),
    pays_min: m?.min, pays_max: m?.max,
    closes_after_h: w?.closes_after_h, closes_within_h: w?.closes_within_h,
  };
}

const box = "flex min-h-16 flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface px-3 focus-within:border-accent-border";
const sel = "min-h-11 w-full cursor-pointer appearance-none bg-transparent pr-5 text-[15px] font-medium text-text outline-none";

function Field({ label, icon, value, onChange, children, testid, wide }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; children: React.ReactNode; testid: string; wide?: boolean;
}) {
  return (
    <label className={`${box} min-w-0 ${wide ? "col-span-2" : ""}`}>
      <span aria-hidden="true" className="flex-none text-soft">{icon}</span>
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className="-mb-2 pt-1 text-xs text-muted">{label}</span>
        <select data-testid={testid} className={sel} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" className="pointer-events-none absolute bottom-3.5 right-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </span>
    </label>
  );
}

const ICON = {
  sport: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" /></svg>,
  mult: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5" /></svg>,
  date: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
};

export function FilterBar({ state, facets, win, total, shown, fallback = false, onChange }: {
  state: FilterState; facets?: MarketsResponse["facets"]; win: { today: Win; week: Win }; total?: number; shown?: number; fallback?: boolean; onChange: Change;
}) {
  // T-wt2b: on the first-screen fallback the cards are NOT in the saved topics, so the bar must not name them: Sport or topic reads
  // Everything, and the count is the one for the cards shown (the "Your topics" pill carries the topics).
  // "Your topics" (fav=1) with no t=: the server resolved the saved topics but the URL doesn't carry them, so the bar reads them from the profile (as for /bets?fav=1&t=…)
  const saved = useProfile().favorite_topics.filter((id) => TAXONOMY[id]);
  const shownState = state.favorites_only && !state.topics?.length && saved.length ? { ...state, topics: saved } : state;
  const applied = fallback ? { ...barValues(shownState, win), sport: "" } : barValues(shownState, win);
  const [draft, setDraft] = useState(applied);
  const key = `${applied.sport}|${applied.mult}|${applied.date}`;
  useEffect(() => setDraft(applied), [key]);   // eslint-disable-line react-hooks/exhaustive-deps -- follow the URL (back, pills, reset)
  const dirty = (Object.keys(draft) as (keyof Bar)[]).some((k) => draft[k] !== applied[k]);

  // Topics with bets first, then the rest; each group keeps every topic so nothing "disappears".
  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, topics: [...g.topics].sort((a, b) => (facets?.topics[b.id] ?? 0) - (facets?.topics[a.id] ?? 0)) })), [facets]);
  const n = (x: number | undefined) => (facets ? (x ? ` (${x})` : " (0 now)") : "");
  const sortKey = SORTS.find((o) => o.sort.key === state.sort.key && o.sort.dir === state.sort.dir)?.key ?? "";

  return (
    <div className="flex flex-col gap-3">
      <form data-testid="filter-bar" className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-raised p-2 md:flex md:flex-row md:items-stretch"
        onSubmit={(e) => { e.preventDefault(); onChange({ ...barPatch(draft, win), ...(!draft.sport && state.favorites_only ? { favorites_only: false } : {}) }); }}>
        <Field wide label="Sport or topic" icon={ICON.sport} value={draft.sport} testid="bar-sport" onChange={(sport) => setDraft((d) => ({ ...d, sport }))}>
          <option value="">Everything</option>
          {(draft.sport === MULTI || applied.sport === MULTI) && <option value={MULTI}>{multiLabel(shownState)}</option>}
          {groups.map((g) => (
            <optgroup key={g.id} label={g.label}>
              <option value={`t:${g.id}`}>All {g.label}{n(facets?.topics[g.id] ?? facets?.categories[g.id])}</option>
              {g.topics.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.label}{n(facets?.topics[t.id])}</option>)}
            </optgroup>
          ))}
          {draft.sport.startsWith("c:") && <option value={draft.sport}>{TAXONOMY[draft.sport.slice(2)]?.label ?? draft.sport.slice(2)}</option>}
        </Field>
        <Field label="Multiplier" icon={ICON.mult} value={draft.mult} testid="bar-mult" onChange={(mult) => setDraft((d) => ({ ...d, mult }))}>
          <option value="">Any</option>
          {MULTIPLIERS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </Field>
        <Field label="Date" icon={ICON.date} value={draft.date} testid="bar-date" onChange={(date) => setDraft((d) => ({ ...d, date }))}>
          <option value="">Any</option>
          <option value="today">Closes today</option>
          <option value="week">Closes this week</option>
          <option value="custom">Pick dates…</option>
        </Field>
        {draft.date === "custom" && (
          <div data-testid="bar-dates" className="col-span-2 grid grid-cols-2 gap-2 md:contents">
            {(["from", "to"] as const).map((k) => (
              <label key={k} className={`${box} min-w-0`}>
                <span className="relative flex min-w-0 flex-1 flex-col">
                  <span className="-mb-1 pt-1 text-xs text-muted">{k === "from" ? "Closes from" : "To (optional)"}</span>
                  <input type="date" data-testid={`bar-${k}`} value={draft[k]} min={k === "to" ? draft.from || undefined : undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    className="min-h-11 w-full bg-transparent text-[15px] font-medium text-text outline-none [color-scheme:dark]" />
                </span>
              </label>
            ))}
          </div>
        )}
        <button type="submit" data-testid="bar-apply"
          className={`col-span-2 flex min-h-12 flex-none items-center justify-center gap-2 rounded-xl px-6 font-semibold md:min-h-16 ${dirty ? "bg-accent text-on-accent hover:bg-accent-hover" : "border border-border bg-muted-bg text-soft"}`}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          Apply
        </button>
      </form>
      <div className="flex items-center justify-between gap-3">
        <p data-testid="bar-count" className="text-sm font-medium text-soft" aria-live="polite">
          {total === undefined ? " " : shown !== undefined ? `Showing ${formatCount(shown)} of ${plural(total, "bet")}` : plural(total, "bet")}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort by
          <span className="relative">
            <select data-testid="bar-sort" value={sortKey} onChange={(e) => { const o = SORTS.find((x) => x.key === e.target.value); if (o) onChange({ sort: o.sort }); }}
              className="min-h-11 cursor-pointer appearance-none rounded-full border border-border bg-surface py-1 pl-4 pr-9 font-medium text-text hover:border-accent-border">
              {!sortKey && <option value="">Custom</option>}
              {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </label>
      </div>
      <SortNote />
    </div>
  );
}

