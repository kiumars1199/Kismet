// Combos (docs/19 P5, docs/18 §5): browse combos by payout (2x+, 3x+, 5x+, 10x+). Same for every Premium user:
// Best bets on different events closing within a day, only combos whose cautious chance still beats the price.
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BetaBadge } from "@/components/beta/BetaBadge";
import { getMe } from "@/lib/auth/server";
import { canBeta } from "@/lib/beta";
import { ComboBrowser } from "./ComboBrowser";

export const metadata = { title: "Combos", description: "Two- and three-leg combos from Best bets on different events, by payout.", alternates: { canonical: "/combos" } };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!canBeta(await getMe(), "combos")) notFound();   // beta: testers only (lib/beta.ts)
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <BetaBadge variant="banner" />
      <div>
        <h1 className="font-heading text-[28px] font-bold leading-tight">Combos</h1>
        <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
          Two or three Best bets from different events, closing within a day, in one bet. Every leg has to win, so the
          payout is bigger and the chance is lower. A combo is shown only if it still beats its price when every leg uses
          our cautious chance.
        </p>
      </div>
      <Suspense>
        <ComboBrowser />
      </Suspense>
    </div>
  );
}
