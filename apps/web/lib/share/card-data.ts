// F13: what the public share image may show for (market, side, signature): the Free-banded numbers for a valid
// signature, otherwise the teaser (title and category, no model output). null = no such market.
import { getStoreFor, type Store } from "@/lib/data/store";
import { marketTeaser, type Teaser } from "@/lib/teaser";
import { betFacts, type BetFacts } from "./bet-facts";
import { shareSig, verifyShareSig } from "./sig";

export type ShareCard = { kind: "numbers"; facts: BetFacts } | { kind: "teaser"; teaser: Teaser };

/** Only a flag (a market in flags.json) on its recommended side gets a card with numbers. The Free store is the one the
 *  public image uses, and the link route judges on it too, so a signed link always renders numbers. */
export function isShareable(store: Store, id: string, side: number): boolean {
  const flag = store.flagsById.get(id);
  return !!flag && flag.best.side_index === side;
}

/** What /api/share/link issues for a market: its recommended side, signed only when that is shareable. null = no such market. */
export function shareLinkParts(store: Store, id: string): { id: string; side: number; sig: string | null } | null {
  const m = store.flagsById.get(id) ?? store.byId.get(id);
  if (!m) return null;
  const side = m.best.side_index;
  return { id: m.id, side, sig: isShareable(store, m.id, side) ? shareSig(m.id, side) : null };
}

/** The numbers for a share link, or null: the signature is valid AND the bet is flagged. Used by the image and by the
 *  og:description, so they always agree. */
export async function shareableFacts(id: string, side: number, sig: string | null | undefined): Promise<BetFacts | null> {
  if (!verifyShareSig(id, side, sig)) return null;
  const store = await getStoreFor("free");
  return isShareable(store, id, side) ? betFacts(store, id, side) : null;
}

export async function shareCardData(id: string, side: number, sig: string | null | undefined): Promise<ShareCard | null> {
  const facts = await shareableFacts(id, side, sig);
  if (facts) return { kind: "numbers", facts };
  const teaser = await marketTeaser(id);
  return teaser ? { kind: "teaser", teaser } : null;
}
