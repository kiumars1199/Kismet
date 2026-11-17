import { Suspense } from "react";
import { OnboardingNudge } from "@/components/onboarding/OnboardingNudge";
import { BestBets } from "@/components/screener/BestBets";

export const metadata = { title: "Best bets", description: "Contracts priced below how often similar bets have won, after fees and the spread." };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <OnboardingNudge />
      <Suspense>
        <BestBets />
      </Suspense>
    </div>
  );
}
