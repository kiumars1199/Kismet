// Kalshi markets + Kalshi Combos (docs/03 § kalshi.json). Beta (lib/beta.ts): testers only, even with
// KALSHI_DATA_PERMISSION off; everyone else = 404; testers with no kalshi.json get an empty state. Once live: KALSHI_DATA_PERMISSION (docs/16 §2). Not indexed (robots.ts) while it depends on a permission flag.
import { notFound } from "next/navigation";
import { BetaBadge } from "@/components/beta/BetaBadge";
import { KalshiBoard } from "@/components/kalshi/KalshiBoard";
import { getMe } from "@/lib/auth/server";
import { canBeta } from "@/lib/beta";
import { getKalshi } from "@/lib/data/store";

export const metadata = { title: "Kalshi markets", description: "Kalshi prices, volume and combos, credited to Kalshi.", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!canBeta(await getMe(), "kalshi")) notFound();
  const data = await getKalshi();
  // Testers see the nav link even before kalshi.json exists (KALSHI_DATA_PERMISSION off): say so instead of a 404.
  if (!data)
    return (
      <section className="mx-auto w-full max-w-[1200px]">
        <BetaBadge variant="banner" className="mb-5 w-full" />
        <h1 className="text-2xl font-bold">Kalshi markets</h1>
        <p className="mt-2 text-sm text-muted">No Kalshi data yet. It appears here after a scan with Kalshi data turned on.</p>
      </section>
    );
  return (
    <>
      <BetaBadge variant="banner" className="mx-auto mb-5 w-full max-w-[1200px]" />
      <KalshiBoard data={data} />
    </>
  );
}
