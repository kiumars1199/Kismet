// F13: what the share image says about a bet. Only what the Free card shows (banded chance), so the image is the same
// for everyone and leaks nothing a Free account can't see. Plain words, no cents.
import { plainTitle, sideLabel } from "@/lib/card";
import { betFigures } from "@/lib/betFigures";
import { gateMarket } from "@/lib/data/gate";
import type { Store } from "@/lib/data/store";

export interface BetFacts { title: string; side: string; mult: string | null; chance: string | null }

/** The drawer's own figures (lib/betFigures: "Pays 1.39x", "wins about 1 in 7") computed on the
 *  Free-banded market, so the image never disagrees with the drawer for the same viewer tier. */
export function betFacts(store: Store, id: string, side?: number): BetFacts | null {
  const exact = store.flagsById.get(id) ?? store.byId.get(id);   // exact rows: band them before use
  if (!exact) return null;
  const m = gateMarket(exact, "free");
  const s = m.sides.find((x) => x.side_index === side) ?? m.best;
  const f = betFigures(s, { market: m });
  const none = (x: string) => !x || x === "—";
  return {
    title: plainTitle(m, s), side: sideLabel(s),
    mult: none(f.pays) ? null : f.pays,
    chance: none(f.wins) ? null : `Bets like this won ${/^over/.test(f.wins) ? "" : "about "}${f.wins} before`,
  };
}
