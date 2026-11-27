"use client";

// Applied-filter pills (F-03): one removable pill per active filter, in plain words (no "edge" or "spread":
// lib/banned.ts). Best bets (T-302) passes `omit` for the filters its chip row already shows (sport, chance, closes,
// Polymarket US), so a choice never shows twice.
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import type { FilterState } from "@/lib/filters/state";
import { TAXONOMY } from "@/lib/taxonomy";
import { money } from "@/lib/format";
import { getRepo } from "@/lib/repo";
import { VERDICT_LABEL } from "@/components/market/labels";
import { BEST_BETS_VERDICTS, queryFor, type Mode } from "./useScreener";

type Pill = { key: string; label: string; patch: Partial<FilterState>; onRemove?: () => Promise<unknown> };
const c = (x: number) => `${Math.round(x * 1000) / 10}%`;
const p = (x: number) => `${Math.round(x * 100)}%`;
const catLabel = (id: string) => (TAXONOMY[id]?.label ?? id).split(" & ")[0]!;
const hours = (h: number) => (h >= 48 && h % 24 === 0 ? `${h / 24} days` : `${h}h`);

function each<T extends string>(key: keyof FilterState, list: T[] | undefined, label: (x: T) => string): Pill[] {
  return (list ?? []).map((x) => {
    const rest = list!.filter((y) => y !== x);
    return { key: `${key}:${x}`, label: label(x), patch: { [key]: rest.length ? rest : undefined } as Partial<FilterState> };
  });
}

function pillsFor(s: FilterState, mode: Mode): Pill[] {
  const out: Pill[] = [];
  const one = (key: string, on: unknown, label: string, patch: Partial<FilterState>) => on !== undefined && on !== false && out.push({ key, label, patch });
  // the search itself shows as parsed chips (components/search/SearchChips.tsx)
  out.push(...each("categories", s.categories, catLabel));
  out.push(...each("exclude_categories", s.exclude_categories, (x) => `Hide ${catLabel(x)}`));
  if (!s.favorites_only) out.push(...each("topics", s.topics, (x) => TAXONOMY[x]?.label ?? x));   // under "Your topics" they are that one pill
  out.push(...each("market_types", s.market_types, (x) => x));
  out.push(...each("periods", s.periods, (x) => (x === "full" ? "Full game" : x)));
  if (s.side !== "best") one("side", true, `Side: ${s.side}`, { side: "best" });
  if (s.price_min !== undefined || s.price_max !== undefined)
    one("price", true, `Price ${c(s.price_min ?? 0)}–${c(s.price_max ?? 1)}`, { price_min: undefined, price_max: undefined });
  if (s.pays_min !== undefined || s.pays_max !== undefined)
    one("pays", true, s.pays_max === undefined ? `Pays ${s.pays_min}x+` : `Pays ${s.pays_min ?? 1}–${s.pays_max}x`, { pays_min: undefined, pays_max: undefined });
  if (s.win_prob_max !== undefined) one("wp1", true, `Chance ≤ ${p(s.win_prob_max)}`, { win_prob_max: undefined });
  if (s.win_prob_min !== undefined) one("wp", true, s.win_prob_min === 0 ? "Long shots shown" : `Chance ≥ ${p(s.win_prob_min)}`, { win_prob_min: undefined });
  if (s.edge_min !== undefined) one("e", true, `Price gap ≥ ${c(s.edge_min)}`, { edge_min: undefined });
  one("conf", s.edge_low_positive, "Confident only", { edge_low_positive: undefined });
  if (s.roi_min !== undefined) one("roi", true, `Return ≥ +${s.roi_min}%`, { roi_min: undefined });
  one("val", s.validated_only, "Tested on past data", { validated_only: undefined });
  const defaultVd = mode === "flags" && s.verdicts?.join(",") === BEST_BETS_VERDICTS.join(",");
  if (!defaultVd) out.push(...each("verdicts", s.verdicts, (x) => VERDICT_LABEL[x]));
  if (s.retention_min !== undefined) one("ret", true, `Kept ≥ ${p(s.retention_min)} at the buy price`, { retention_min: undefined });
  if (s.capacity_min_usd !== undefined) one("cap", true, `Room ≥ ${money(s.capacity_min_usd)}`, { capacity_min_usd: undefined });
  if (s.min_events !== undefined) one("ev", true, `≥ ${s.min_events} past events`, { min_events: undefined });
  if (s.closes_within_h !== undefined) one("cw", true, `Closes within ${hours(s.closes_within_h)}`, { closes_within_h: undefined });
  if (s.closes_after_h !== undefined) one("ca", true, `Closes after ${hours(s.closes_after_h)}`, { closes_after_h: undefined });
  if (s.closes_from !== undefined || s.closes_to !== undefined) {
    const d = (u: number) => new Date(u * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const [f, t] = [s.closes_from, s.closes_to];
    const label = f !== undefined && t !== undefined ? (d(f) === d(t) ? `Closes ${d(f)}` : `Closes ${d(f)} – ${d(t)}`) : f !== undefined ? `Closes from ${d(f)}` : `Closes by ${d(t!)}`;
    one("cf", true, label, { closes_from: undefined, closes_to: undefined });
  }
  one("live", s.live_only, "Live now", { live_only: undefined });
  out.push(...each("frequency", s.frequency, (x) => (x === "15M" ? "Every 15 min" : x)));
  if (s.volume_min !== undefined) one("vol", true, `Volume ≥ ${money(s.volume_min)}`, { volume_min: undefined });
  if (s.volume_24h_min !== undefined) one("v24", true, `24h volume ≥ ${money(s.volume_24h_min)}`, { volume_24h_min: undefined });
  if (s.liquidity_min !== undefined) one("liq", true, `Liquidity ≥ ${money(s.liquidity_min)}`, { liquidity_min: undefined });
  if (s.spread_max !== undefined) one("sp", true, `Buy/sell gap ≤ ${c(s.spread_max)}`, { spread_max: undefined });
  one("wl", s.watchlisted_only, "My list only", { watchlisted_only: undefined });
  if (s.favorites_only) out.push({ key: "fav", label: "Your topics", patch: { favorites_only: undefined, topics: undefined }, onRemove: () => getRepo().profile.patch({ topics_off: true }).catch(() => {}) });   // F5: stays cleared on every device
  if (!s.group_by_event) one("g", true, mode === "markets" ? "Not grouped by event" : "Every bet, not one per game", { group_by_event: true });
  return out;
}

export function AppliedPills({ state, mode, onChange, onReset, omit }: {
  state: FilterState; mode: Mode; onChange: (p: Partial<FilterState>) => void; onReset: () => void; omit?: (key: string) => boolean;
}) {
  const pathname = usePathname();
  const pills = pillsFor(state, mode).filter((pl) => !omit?.(pl.key));
  if (!pills.length) return null;
  // Each pill is a real link to the same view without that filter: a tap before hydration (a slow phone) still works.
  // Once hydrated the click is handled here instead (soft navigation, and the topics save first). Removing "Your topics"
  // links to fav=0 so the middleware does not send a bare /bets straight back to the filtered view; only the click
  // handler also saves topics_off.
  const hrefFor = (patch: Partial<FilterState>) => {
    const next = { ...state, page: 1, ...patch };
    if (state.favorites_only && !next.favorites_only) next.favorites_only = false;
    return pathname + queryFor(next, mode);
  };
  const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  return (
    <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-2">
      {pills.map((pl) => (
        <li key={pl.key}>
          <a
            href={hrefFor(pl.patch)}
            onClick={(e) => { if (!plain(e)) return; e.preventDefault(); if (pl.onRemove) void pl.onRemove().then(() => onChange(pl.patch)); else onChange(pl.patch); }}   // F5: the save lands first, or the server would reopen the filter
            aria-label={`Remove filter: ${pl.label}`}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-accent-border bg-accent-bg py-1 pl-3 pr-2 text-[13px] text-accent-soft hover:border-accent"
          >
            {pl.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </a>
        </li>
      ))}
      <li>
        <a href={pathname + (state.favorites_only ? "?fav=0" : "")} onClick={(e) => { if (!plain(e)) return; e.preventDefault(); onReset(); }} className="inline-flex min-h-11 items-center px-2 text-[13px] text-muted hover:text-text">Clear all</a>
      </li>
    </ul>
  );
}
