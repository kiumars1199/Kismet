// F13: what the public share image may show for (market, side, signature): the Free-banded numbers for a valid
// signature, otherwise the teaser (title and category, no model output). null = no such market.
import { getStoreFor, type Store } from "@/lib/data/store";
import { marketTeaser, type Teaser } from "@/lib/teaser";
import { betFacts, type BetFacts } from "./bet-facts";
import { verifyShareSig } from "./sig";

export type ShareCard = { kind: "numbers"; facts: BetFacts } | { kind: "teaser"; teaser: Teaser };

/** Only a flagged bet (the recommended side, with a positive edge) gets a card with numbers. Judged on the exact row. */
export function isShareable(store: Store, id: string, side: number): boolean {
  const m = store.flagsById.get(id) ?? store.byId.get(id);
  return !!m && m.best.side_index === side && m.best.edge > 0;
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
