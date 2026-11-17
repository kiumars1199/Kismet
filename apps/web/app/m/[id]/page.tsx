// Shareable market page (T-25): the drawer's content as a page, server-rendered from the store.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { MarketResponse } from "@/lib/api";
import { categoryRecord, curve, segmentOf } from "@/lib/data/model";
import { getStore } from "@/lib/data/store";
import { betLine, ret } from "@/lib/format";
import { MarketDetail } from "@/components/market/MarketDetail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ side?: string }> };

async function load(id: string): Promise<MarketResponse | null> {
  const store = await getStore();
  const m = store.flagsById.get(id) ?? store.byId.get(id);
  if (!m) return null;
  const segment = segmentOf(m);
  return {
    market: m,
    segment,
    curve: curve(store.model, segment, m.horizon_h),
    backtest: categoryRecord(store.backtest, m.category),
    event_markets: (store.byEvent.get(m.event_id) ?? []).filter((x) => x.id !== id),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).id).catch(() => null);
  if (!data) return { title: "Market" };
  const m = data.market;
  return { title: m.question, description: `${betLine(m.best)} · ${ret(m.best.roi_pct)} expected return. Market analytics, not financial advice.` };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { side }] = await Promise.all([params, searchParams]);
  const data = await load(id);
  if (!data) notFound();
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Suspense>
        <MarketDetail id={id} side={side === "0" ? 0 : side === "1" ? 1 : undefined} initial={data} />
      </Suspense>
    </div>
  );
}
