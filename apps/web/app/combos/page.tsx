// Combos (docs/19 P5, docs/18 §5): browse combos by payout (2x+, 3x+, 5x+, 10x+). Same for every Premium user:
// Best bets on different events closing within a day, only combos whose cautious chance still beats the price.
// Live since Nov 21 (owner decision). Premium (lib/entitlements); Free and Pro get what it is and the upgrade link.
import Link from "next/link";
import { Suspense } from "react";
import { getMe } from "@/lib/auth/server";
import { canBeta } from "@/lib/beta";
import { COMBOS_PAGE_FREE_PRO } from "@/lib/check/copy";
import { pausedResponse } from "@/lib/account/pause";
import { browseCombos, COMBO_PAYS, gateCombos, type CombosResponse, type ComboPays } from "@/lib/data/combos";
import { getStoreFor } from "@/lib/data/store";
import { ComboBrowser } from "./ComboBrowser";

export const metadata = { title: "Combos", description: "Two- and three-leg combos from Best bets on different events, by payout.", alternates: { canonical: "/combos" } };
export const dynamic = "force-dynamic";

/** The list for the chosen payout, built here so it is in the first HTML (T-wt3j: fetched in the browser it arrived after the footer had been painted, and the footer jumped by
 *  the list's whole height). Only for a Premium viewer the same way /api/combos is (canBeta + the tier's own gating); anything else, or a store that cannot load, returns
 *  undefined and the browser asks the API as before. */
async function firstList(me: Awaited<ReturnType<typeof getMe>>, pays: ComboPays): Promise<CombosResponse | undefined> {
  try {
    if (!canBeta(me, "combos") || pausedResponse(me)) return undefined;
    return gateCombos(browseCombos(await getStoreFor(me.tier), pays), me.tier);
  } catch {
    return undefined;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await getMe();
  const allowed = canBeta(me, "combos");
  const asked = Number((await searchParams).pays);
  const pays: ComboPays = COMBO_PAYS.includes(asked as ComboPays) ? (asked as ComboPays) : 2;
  const data = allowed ? await firstList(me, pays) : undefined;
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <div>
        <h1 className="font-heading text-[28px] font-bold leading-tight">Combos</h1>
        <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
          Best bets from different events, closing within a day, in one bet. Every leg has to win, so the payout is bigger
          and the chance is lower. A combo is shown only if it still beats its price when every leg uses our cautious
          chance.
        </p>
      </div>
      {allowed ? (
        <Suspense>
          <ComboBrowser initial={data ? { pays, data } : undefined} />
        </Suspense>
      ) : (
        <div data-testid="combos-upgrade" className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-5">
          <p className="text-sm text-soft">
            <Link href="/check/combo" className="text-accent-hover underline-offset-4 hover:underline">{COMBOS_PAGE_FREE_PRO.have}</Link>{" "}
            {COMBOS_PAGE_FREE_PRO.premium}
          </p>
          <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">See Premium</Link>
        </div>
      )}
    </div>
  );
}
