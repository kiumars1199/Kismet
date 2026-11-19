// Kalshi markets + Kalshi Combos (docs/03 § kalshi.json). Behind KALSHI_DATA_PERMISSION (docs/16 §2): off or no
// kalshi.json = 404. Not indexed (robots.ts) while it depends on a permission flag.
import { notFound } from "next/navigation";
import { KalshiBoard } from "@/components/kalshi/KalshiBoard";
import { getKalshi } from "@/lib/data/store";
import { kalshiDataEnabled } from "@/lib/kalshiCombo";

export const metadata = { title: "Kalshi markets", description: "Kalshi prices, volume and combos, credited to Kalshi.", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = kalshiDataEnabled() ? await getKalshi() : undefined;
  if (!data) notFound();
  return <KalshiBoard data={data} />;
}
