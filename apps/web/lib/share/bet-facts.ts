// F13: what the share image says about a bet. Only what the Free card shows (banded chance), so the image is the same
// for everyone and leaks nothing a Free account can't see. Plain words, no cents.
import { cardVenue, chanceLine, multX, on10, plainTitle, sideLabel, STAKE } from "@/lib/card";
import { gateMarket } from "@/lib/data/gate";
import type { Store } from "@/lib/data/store";

export interface BetFacts { title: string; side: string; mult: string | null; chance: string | null }

export function betFacts(store: Store, id: string, side?: number): BetFacts | null {
  const exact = store.flagsById.get(id) ?? store.byId.get(id);   // exact rows: band them before use
  if (!exact) return null;
  const m = gateMarket(exact, "free");
  const s = m.sides.find((x) => x.side_index === side) ?? m.best;
  const pay = on10(cardVenue(m, s));
  const chance = chanceLine(s.win_prob);
  return { title: plainTitle(m, s), side: sideLabel(s), mult: pay ? multX(pay.back / STAKE) : null, chance: chance === "—" ? null : chance };
}
