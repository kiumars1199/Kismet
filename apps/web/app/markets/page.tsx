import { Suspense } from "react";
import { MarketsScreener } from "@/components/screener/MarketsScreener";

export const metadata = { title: "All markets", description: "Every open prediction market with its estimated win chance and expected return after fees and spread." };

export default function Page() {
  return (
    <Suspense>
      <MarketsScreener />
    </Suspense>
  );
}
