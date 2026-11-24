// Bet checker (SPEC F1): paste a link or search, see our chance, the market's price, the payout, the edge and a 0–100 score.
// The answer depends only on market, side, price and stake, never on who is asking.
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { CheckClient } from "@/components/check/CheckClient";
import { getMe } from "@/lib/auth/server";
import { checkWouldLimit } from "@/lib/check/limit";
import { isOpenIn } from "@/lib/check/open";
import { getStoreFor } from "@/lib/data/store";

export const metadata = { title: "Bet checker", description: "Paste a Polymarket or Kalshi link and see whether the price is better than usual.", alternates: { canonical: "/check" } };

type Search = Record<string, string | string[] | undefined>;

async function limitedNow(m: string, side: 0 | 1): Promise<boolean> {
  try {
    const me = await getMe();
    const store = await getStoreFor(me.tier);
    const market = store.byId.get(m) ?? store.flagsById.get(m);
    if (!market || !isOpenIn(market, store) || !market.sides.some((x) => x.side_index === side)) return false;   // the API answers those with a note, not the limit
    return (await checkWouldLimit(new Request("http://page.local/check", { headers: await headers() }), me.tier, me.user?.id, market.id, side)) === true;
  } catch {
    return false;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const m = typeof sp.m === "string" ? sp.m : undefined;
  // T-wt2i: the day's real limit state, read here without consuming a check (same counter and key as /api/check: the account, or the
  // signed-out device). When Free's check is already used by another market, the limit card is in the first HTML, with no skeleton
  // and no reserved screenful that would collapse later. Anything unknown (a paid plan, no ?m=, an unknown market, a store that can't
  // say) keeps the reservation until the API answers: the height is never released on a guess.
  const limited = m ? await limitedNow(m, sp.side === "1" ? 1 : 0) : false;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <div>
        <h1 className="font-heading text-[28px] font-bold leading-tight">Bet checker</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Paste a market link or search by words. Change the side, price or stake and every number updates.</p>
        <Link href="/check/combo" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-hover underline-offset-4 hover:underline">Check a combo</Link>
      </div>
      <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
        <CheckClient limitedNow={limited} />
      </Suspense>
    </div>
  );
}
