// Suggested combos (docs/18 §5.2): the same for everyone. Tier-"best" bets on different events that close within
// 24 h; the top 5 two-leg and three-leg combos by return whose cautious chance Q_low still beats the price.
// A leg count whose combo backtest lost money (or was never tested) is left out.
import { combo, legOf, type Combo, type Leg } from "@/lib/combos";
import { band } from "@/lib/data/gate";
import { can, type Tier } from "@/lib/entitlements";
import type { ComboBacktestRecord } from "@/lib/types";
import type { Store } from "./store";

export interface SuggestedCombo extends Combo { items: Leg[]; ret_range?: [number | null, number | null] }
export interface ComboGroup { size: 2 | 3; record: ComboBacktestRecord; combos: SuggestedCombo[] }
export interface CombosResponse { groups: ComboGroup[] }

const POOL = 40;   // ponytail: top 40 legs by return → ≤ 9,880 triples; widen if suggestions look samey
const TOP = 5;
const cache = new WeakMap<Store, ComboGroup[]>();

function* choose<T>(xs: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) return yield acc;
  for (let i = start; i < xs.length; i++) yield* choose(xs, k, i + 1, [...acc, xs[i]!]);
}

export function suggestCombos(store: Store): ComboGroup[] {
  const hit = cache.get(store);
  if (hit) return hit;
  // one leg per event (its best-return side), so every combo is across different events
  const perEvent = new Map<string, Leg & { roi: number }>();
  for (const m of store.flags) {
    const v = m.execution?.verdict;
    if ((m.tier ?? "best") !== "best" || (v !== "worth it" && v !== "thin") || !(m.hours_to_close > 0 && m.hours_to_close <= 24)) continue;
    const s = m.best;
    const cur = perEvent.get(m.event_id);
    if (!cur || s.roi_pct > cur.roi) perEvent.set(m.event_id, { ...legOf(m, s), roi: s.roi_pct });
  }
  const pool = [...perEvent.values()].sort((a, b) => b.roi - a.roi).slice(0, POOL).map(({ roi: _roi, ...l }) => l as Leg);

  const groups: ComboGroup[] = [];
  for (const size of [2, 3] as const) {
    const record = store.backtest.combos?.[String(size)];
    if (!record || !(record.combos > 0) || !((record.roi_pct ?? 0) > 0)) continue;   // lost money in testing → hidden
    const found: SuggestedCombo[] = [];
    for (const items of choose(pool, size)) {
      const c = combo(items);
      if (c.has_edge) found.push({ ...c, items });
    }
    found.sort((a, b) => b.ret - a.ret);
    if (found.length) groups.push({ size, record, combos: found.slice(0, TOP) });
  }
  cache.set(store, groups);
  return groups;
}

/** Free tier: no exact return or win chance (docs/15 § Paywall): return as a band, chances floored to 5%. */
const floor5 = (p: number) => Math.floor(p * 20) / 20;
export function gateCombos(groups: ComboGroup[], tier: Tier): CombosResponse {
  if (can(tier, "exact_edge")) return { groups };
  return {
    groups: groups.map((g) => ({
      ...g,
      combos: g.combos.map((c) => {
        const ret_range = band(c.ret * 100, [0, 5, 10, 20, 50]);
        return {
          ...c, ret: (ret_range[0] ?? 0) / 100, ret_range, q: floor5(c.q), q_low: floor5(c.q_low),
          items: c.items.map((l) => ({ ...l, q: floor5(l.q), q_low: floor5(l.q_low) })),
        };
      }),
    })),
  };
}
