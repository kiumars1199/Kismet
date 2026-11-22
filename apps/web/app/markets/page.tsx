import { MarketsScreener } from "@/components/screener/MarketsScreener";
import { getMe } from "@/lib/auth/server";
import { canBeta } from "@/lib/beta";
import { firstPage } from "@/lib/data/respond";
import { getKalshiIndex } from "@/lib/data/store";

export const metadata = { title: "All markets", description: "Every open prediction market with its estimated win chance and estimated return after fees and spread." };

type Search = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0]! : v]])));
  const initial = await firstPage(params, "markets");   // P6: page 1 ships with the HTML; same body as /api/markets
  // no Suspense: see app/bets/page.tsx (a boundary held back the server-rendered rows)
  // F3: the venue chips are decided here (Kalshi permitted and its index loaded), not after the client's /api/meta fetch: no layout shift
  const kalshiOn = canBeta(await getMe(), "kalshi") && ((await getKalshiIndex())?.rows.length ?? 0) > 0;
  return <MarketsScreener initial={initial?.main} scannedAt={initial?.scanned_at} kalshiOn={kalshiOn} />;
}
