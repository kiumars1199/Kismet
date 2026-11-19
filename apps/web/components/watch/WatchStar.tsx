"use client";
// Save to My list (docs/05 F-09). Toggles instantly; stores a snapshot of the numbers at save time so My list can
// show "since saved". Without `market` it fetches the market first so the snapshot is real data.
import { fetchMarket } from "@/lib/api";
import { useEntitlements } from "@/lib/entitlements";
import { getRepo } from "@/lib/repo";
import { useCollection } from "@/lib/repo/hooks";
import type { Market } from "@/lib/types";

export interface WatchSnapshot {
  ask: number; win_prob: number; edge: number; roi_pct: number;
  question: string; outcome: string | null; closes_at: number; saved_side: 0 | 1;
}

function snapshotOf(m: Market, side?: 0 | 1): WatchSnapshot {
  const s = (side === undefined ? undefined : m.sides[side]) ?? m.best;
  return {
    ask: s.ask, win_prob: s.win_prob, edge: s.edge, roi_pct: s.roi_pct,
    question: m.question, outcome: side === undefined ? null : s.outcome, closes_at: m.closes_at, saved_side: s.side_index,
  };
}

export function WatchStar({ marketId, side, market }: { marketId: string; side?: 0 | 1; market?: Market }) {
  const list = useCollection("watchlist");
  const { quota } = useEntitlements();
  const sideIndex = side ?? null;
  const item = list.find((w) => w.market_id === marketId && w.side_index === sideIndex);
  const full = !item && list.length >= quota("watchlist");

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // stars sit inside clickable rows
    const repo = getRepo();
    if (item) return repo.watchlist.remove(item.id);
    if (full) return;
    const row = await repo.watchlist.insert({
      market_id: marketId, side_index: sideIndex, note: null, target_price: null,
      snapshot: market ? snapshotOf(market, side) : null,
    }).catch(() => null); // unique clash = already saved in another tab
    if (row && !market) {
      const m = await fetchMarket(marketId).then((r) => r.market, () => null);
      if (m) await repo.watchlist.update(row.id, { snapshot: snapshotOf(m, side) });
    }
  }

  return (
    <button
      type="button"
      data-watch
      onClick={toggle}
      aria-pressed={!!item}
      aria-label={item ? "Saved" : "Save"}
      title={full ? "My list is full on your plan" : item ? "Saved to My list. Click to remove." : "Save to My list"}
      disabled={full}
      className={`flex size-11 flex-none items-center justify-center rounded-input hover:bg-raised disabled:opacity-40 ${item ? "text-accent" : "text-muted hover:text-text"}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={item ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
      </svg>
    </button>
  );
}
