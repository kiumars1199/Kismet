// F12: the bets in one user's digest, built the way the site builds Best bets for that user's plan.
//  - Pro and Premium: the live top bets (lib/data/respond listBody, tier "best", the user's own chosen topics).
//  - Free: the SAME Free daily sample the site shows that user on /bets that day, from the delayed Free store (listBody with
//    the user's sample key), so the email never holds a bet a Free user couldn't see on the site.
// Payouts are betQuote().paysText: after the fee, at the price the card shows, the same text as the site.
import "server-only";
import { betQuote } from "@/lib/betFigures";
import { freeView } from "@/lib/data/gate";
import { listBody } from "@/lib/data/respond";
import type { Store } from "@/lib/data/store";
import type { Tier } from "@/lib/entitlements";
import { FilterState } from "@/lib/filters/state";
import { MAX_DIGEST_BETS, type DigestBet } from "./digest-templates";

export interface DigestStores { live: Store; free: Store }

export async function digestBets(stores: DigestStores, tier: Tier, userId: string, topics: string[]): Promise<DigestBet[]> {
  const paid = tier !== "free";
  const store = paid ? stores.live : freeView(stores.free);
  const f = FilterState.parse({ view: "flags", tier: "best", page_size: MAX_DIGEST_BETS, ...(topics.length ? { topics } : {}) });
  const body = await listBody(store, f, tier, `u:${userId}`);
  return (body?.rows ?? []).slice(0, MAX_DIGEST_BETS).map(({ market: m, side }) => ({
    id: m.id, title: `${m.niche.toUpperCase()} · ${m.question}`, outcome: side.outcome, ask: side.ask, fee: side.fee ?? null,
    pays: betQuote(m, side).paysText, win_prob: side.win_prob, side_index: side.side_index, closes_at: m.closes_at,
  }));
}
