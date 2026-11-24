"use client";
// Payout tabs (?pays=2|3|5|10) and the combos for the chosen one, from /api/combos?pays=.
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ComboCard } from "@/components/combo/SuggestedCombos";
import { fetchCombos } from "@/lib/api";
import { COMBO_PAYS, rangeLine, type ComboPays } from "@/lib/combos";
import type { CombosResponse } from "@/lib/data/combos";
import { testedLine } from "@/lib/format";
import { noLiveRecord } from "@/lib/proof";
import { softNav } from "@/lib/softNav";

export function ComboBrowser({ lists }: { lists?: Record<ComboPays, CombosResponse> }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const asked = Number(params.get("pays"));
  const pays: ComboPays = COMBO_PAYS.includes(asked as ComboPays) ? (asked as ComboPays) : 2;
  const [res, setRes] = useState<{ pays: ComboPays; data?: CombosResponse; error?: boolean } | null>(null);   // only used when the server did not send the lists

  useEffect(() => {
    if (lists) return;   // the server sent all four lists: a payout tap needs no request
    const ac = new AbortController();
    fetchCombos({ signal: ac.signal }, pays).then((data) => setRes({ pays, data }), () => !ac.signal.aborted && setRes({ pays, error: true }));
    return () => ac.abort();
  }, [pays, lists]);

  const loading = !lists && res?.pays !== pays;
  // switching the payout keeps the room of the list that is showing (hidden) until the new one lands (a collapse to "Loading combos…" and back would move the footer twice)
  const shownData = lists ? lists[pays] : res?.data;
  const groups = shownData?.groups ?? [];
  const stale = loading && !!shownData;
  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Payout" className="flex flex-wrap gap-2">
        {COMBO_PAYS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === pays}
            onClick={() => softNav(`${pathname}?pays=${p}`, { replace: true })}
            className={`min-h-11 rounded-input border px-4 text-sm font-medium ${p === pays ? "border-accent bg-accent/10 text-text" : "border-border text-muted hover:text-text"}`}
          >
            Pays {p}x+
          </button>
        ))}
      </div>
      {loading && !shownData ? (
        <p aria-busy="true" className="min-h-[60svh] text-sm text-muted">Loading combos…</p>
      ) : res?.error ? (
        <p role="alert" className="text-sm text-muted">Couldn&apos;t load combos. Try again in a moment.</p>
      ) : !groups.length ? (
        <p data-testid="combos-empty" className={`text-sm text-muted ${stale ? "invisible" : ""}`}>
          No combo pays {lists ? pays : (res?.pays ?? pays)}x or more with an edge right now. New Best bets come in with every scan.
        </p>
      ) : (
        <div aria-busy={stale} className={`flex flex-col gap-5 ${stale ? "invisible" : ""}`}>
          <p data-testid="combos-range" className="-mt-1 text-sm text-soft">{rangeLine(groups.flatMap((g) => g.combos))}.</p>
          {groups.map((g) => (
            <section key={g.size} aria-labelledby={`combos-${g.size}`} className="flex flex-col gap-3">
              <div>
                <h2 id={`combos-${g.size}`} className="text-xl font-semibold">{g.size}-leg combos</h2>
                <p className="mt-1 text-[13px] text-muted">{testedLine(g.record, `${g.size}-leg combos`)}. {noLiveRecord("combos")}</p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.combos.map((c) => <ComboCard key={c.items.map((l) => l.market_id).join("-")} c={c} wide />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
