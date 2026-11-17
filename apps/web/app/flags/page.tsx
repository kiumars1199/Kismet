import { Suspense } from "react";
import { BestBets } from "@/components/screener/BestBets";

export const metadata = { title: "Best bets" };

export default function Page() {
  return (
    <Suspense>
      <BestBets />
    </Suspense>
  );
}
