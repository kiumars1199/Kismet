import { Suspense } from "react";
import { MarketsScreener } from "@/components/screener/MarketsScreener";

export const metadata = { title: "All markets" };

export default function Page() {
  return (
    <Suspense>
      <MarketsScreener />
    </Suspense>
  );
}
