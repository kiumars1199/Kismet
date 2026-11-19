// Kalshi markets + Kalshi Combos (docs/03 § kalshi.json). Beta (lib/beta.ts): testers only, even with
// KALSHI_DATA_PERMISSION off; everyone else (or no kalshi.json) = 404. Once live: KALSHI_DATA_PERMISSION (docs/16 §2). Not indexed (robots.ts) while it depends on a permission flag.
import { notFound } from "next/navigation";
import { BetaBadge } from "@/components/beta/BetaBadge";
import { KalshiBoard } from "@/components/kalshi/KalshiBoard";
import { getMe } from "@/lib/auth/server";
import { canBeta } from "@/lib/beta";
import { getKalshi } from "@/lib/data/store";

export const metadata = { title: "Kalshi markets", description: "Kalshi prices, volume and combos, credited to Kalshi.", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = canBeta(await getMe(), "kalshi") ? await getKalshi() : undefined;
  if (!data) notFound();
  return (
    <>
      <BetaBadge variant="banner" className="mx-auto mb-5 w-full max-w-[1200px]" />
      <KalshiBoard data={data} />
    </>
  );
}
