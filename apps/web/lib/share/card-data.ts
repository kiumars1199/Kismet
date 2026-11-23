// F13: what the public share image may show for (market, side, signature): the Free-banded numbers for a valid
// signature, otherwise the teaser (title and category, no model output). null = no such market.
import { getStoreFor } from "@/lib/data/store";
import { marketTeaser, type Teaser } from "@/lib/teaser";
import { betFacts, type BetFacts } from "./bet-facts";
import { verifyShareSig } from "./sig";

export type ShareCard = { kind: "numbers"; facts: BetFacts } | { kind: "teaser"; teaser: Teaser };

export async function shareCardData(id: string, side: number, sig: string | null | undefined): Promise<ShareCard | null> {
  const store = await getStoreFor("free");
  if (verifyShareSig(id, side, sig)) {
    const facts = betFacts(store, id, side);
    if (facts) return { kind: "numbers", facts };
  }
  const teaser = await marketTeaser(id);
  return teaser ? { kind: "teaser", teaser } : null;
}
