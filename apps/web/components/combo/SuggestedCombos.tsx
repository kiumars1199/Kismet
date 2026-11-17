"use client";
// "Combos" row on Best bets (docs/18 §5.2, §6): the same suggestions for everyone, built from Best bets on
// different events closing within 24 h. Shows the combo backtest record; the server already drops a leg count
// that lost money in testing, so an empty answer hides the row.
import { useEffect, useState } from "react";
import { fetchCombos } from "@/lib/api";
import { comboLabel } from "@/lib/combos";
import type { CombosResponse, SuggestedCombo } from "@/lib/data/combos";
import { pct, price, ret, testedLine, winsAbout } from "@/lib/format";
import { useCombo } from "./useCombo";

const retText = (c: SuggestedCombo) =>
  c.ret_range ? (c.ret_range[1] === null ? `over ${ret(c.ret_range[0]!)}` : `${ret(c.ret_range[0] ?? 0)}–${ret(c.ret_range[1]).replace(/^\+/, "")}`) : ret(c.ret * 100);

export function SuggestedCombos() {
  const [data, setData] = useState<CombosResponse | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetchCombos({ signal: ac.signal }).then(setData, () => {});
    return () => ac.abort();
  }, []);
  const groups = data?.groups ?? [];
  if (!groups.length) return null;
  const combos = groups.flatMap((g) => g.combos);

  return (
    <section aria-labelledby="combos-h" data-testid="suggested-combos" className="flex flex-col gap-3">
      <div>
        <h2 id="combos-h" className="text-xl font-semibold">Combos</h2>
        <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
          Two or three Best bets from different events, closing within a day, in one bet. Bigger payout, lower chance:
          every leg has to win. {groups.map((g) => testedLine(g.record, `${g.size}-leg combos`)).filter(Boolean).join(". ")}.
        </p>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {combos.map((c) => <ComboCard key={c.items.map((l) => l.market_id).join("-")} c={c} />)}
      </ul>
    </section>
  );
}

function ComboCard({ c }: { c: SuggestedCombo }) {
  const load = () => useCombo.setState({ legs: c.items, open: true });
  return (
    <li className="flex w-[300px] flex-none snap-start flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <p className="text-xs text-muted">Combo · {c.legs} legs</p>
      <p className="-mt-2 font-heading text-[22px] font-bold leading-tight">
        Pays {c.pays >= 10 ? Math.round(c.pays) : c.pays.toFixed(1)}x <span className="font-sans text-sm font-medium text-soft">· wins about {winsAbout(c.q)}</span>
      </p>
      <ol className="flex flex-col gap-1.5 text-[13px]">
        {c.items.map((l) => (
          <li key={l.market_id} className="flex gap-2">
            <span className="flex-none font-medium tabular-nums text-soft">{l.outcome} {price(l.ask)}</span>
            <span className="line-clamp-1 text-muted">{l.question}</span>
          </li>
        ))}
      </ol>
      <p className="mt-auto text-[13px] text-muted">
        Estimated return <span className="font-semibold text-accent">{retText(c)}</span> · cautious chance {pct(c.q_low)}
      </p>
      <button type="button" onClick={load} aria-label={`Build this combo: ${comboLabel(c, winsAbout(c.q))}`}
        className="min-h-11 rounded-input border border-border bg-muted-bg px-3 text-sm font-medium hover:border-accent-border">
        Build this combo
      </button>
    </li>
  );
}
