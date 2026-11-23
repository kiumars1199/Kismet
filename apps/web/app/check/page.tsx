// Bet checker (SPEC F1): paste a link or search, see our chance, the market's price, the payout, the edge and a 0–100 score.
// The answer depends only on market, side, price and stake, never on who is asking.
import { Suspense } from "react";
import { CheckClient } from "@/components/check/CheckClient";

export const metadata = { title: "Bet checker", description: "Paste a Polymarket or Kalshi link and see whether the price is better than usual.", alternates: { canonical: "/check" } };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <div>
        <h1 className="font-heading text-[28px] font-bold leading-tight">Bet checker</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Paste a market link or search by words. Change the side, price or stake and every number updates.</p>
      </div>
      <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
        <CheckClient />
      </Suspense>
    </div>
  );
}
