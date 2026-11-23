// Combo checker (SPEC F2): 2-10 legs from any market, one combined chance, payout and score.
import { Suspense } from "react";
import { ComboClient } from "@/components/check/ComboClient";

export const metadata = { title: "Combo checker", description: "Add 2 to 10 bets and see the combined chance, payout and score.", alternates: { canonical: "/check/combo" } };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <div>
        <h1 className="font-heading text-[28px] font-bold leading-tight">Combo checker</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Add 2 to 10 bets. Every leg has to win, so the payout is bigger and the chance is lower.</p>
      </div>
      <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
        <ComboClient />
      </Suspense>
    </div>
  );
}
