// Combo checker (SPEC F2): 2-10 legs from any market, one combined chance, payout and score.
import { cookies } from "next/headers";
import { Suspense } from "react";
import { ComboClient } from "@/components/check/ComboClient";
import { COUNT_COOKIE, reservedLegs } from "@/lib/check/comboLegs";

export const metadata = { title: "Combo checker", description: "Add 2 to 10 bets and see the combined chance, payout and score.", alternates: { canonical: "/check/combo" } };

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string | string[] }> }) {
  // T-89c: the server knows a leg is coming (a ?m= link, or the count this browser kept), so the legs list holds its height
  // from the first paint instead of growing after hydration.
  const [{ m }, jar] = await Promise.all([searchParams, cookies()]);
  const reserve = reservedLegs(jar.get(COUNT_COOKIE)?.value, Array.isArray(m) ? m[0] : m);
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <div>
        <h1 className="font-heading text-[28px] font-bold leading-tight">Combo checker</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Every leg has to win, so the payout is bigger and the chance is lower.</p>
      </div>
      <Suspense fallback={<div className="h-11" aria-hidden="true" />}>
        <ComboClient reserve={reserve} />
      </Suspense>
    </div>
  );
}
