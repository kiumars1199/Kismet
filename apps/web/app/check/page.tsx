// Bet checker (SPEC F1): paste a link or search, see our chance, the market's price, the payout, the edge and a 0–100 score.
// The answer depends only on market, side, price and stake, never on who is asking.
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CheckClient } from "@/components/check/CheckClient";
import { getMe } from "@/lib/auth/server";
import { CHECK_USED_COOKIE, limitHinted } from "@/lib/check/limit";
import { quota } from "@/lib/entitlements";

export const metadata = { title: "Bet checker", description: "Paste a Polymarket or Kalshi link and see whether the price is better than usual.", alternates: { canonical: "/check" } };

type Search = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const m = typeof sp.m === "string" ? sp.m : undefined;
  // T-wt2i: a Free visitor who used today's check and opens another market gets the limit card in the first HTML (a hint cookie set by /api/check;
  // the API still decides), instead of a skeleton that later collapses and moves the footer.
  const hinted = !!m && quota((await getMe()).tier, "checks_day") !== Infinity
    && limitHinted((await cookies()).get(CHECK_USED_COOKIE)?.value, m, sp.side === "1" ? 1 : 0);   // Next hands the cookie decoded
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <div>
        <h1 className="font-heading text-[28px] font-bold leading-tight">Bet checker</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Paste a market link or search by words. Change the side, price or stake and every number updates.</p>
        <Link href="/check/combo" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-hover underline-offset-4 hover:underline">Check a combo</Link>
      </div>
      <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
        <CheckClient limitHinted={hinted} />
      </Suspense>
    </div>
  );
}
