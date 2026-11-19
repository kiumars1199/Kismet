// Shareable market page (T-25): the drawer's content as a page, server-rendered from the store.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import type { MarketResponse } from "@/lib/api";
import { SlowDown, liveMarketBody, pageBudget, pageStore, pendingLine } from "@/lib/data/respond";
import { PendingState } from "@/components/screener/States";
import { SlowDownState } from "@/components/screener/SlowDownState";
import { betLine, sideRet } from "@/lib/format";
import { MarketDetail } from "@/components/market/MarketDetail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ side?: string }> };

// T-44: same tier shaping as /api/markets/[id]; RT3-02: same rate limit, plus the Free row budget. cache(): the
// metadata and the page share one load (one count) per request.
const load = cache(async (id: string): Promise<MarketResponse | null> => {
  const ctx = await pageStore();
  const m = ctx.store.flagsById.get(id) ?? ctx.store.byId.get(id);
  if (!m) return null;
  await pageBudget(ctx, [m.id]);
  return liveMarketBody(ctx.store, m, ctx.tier);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let data: MarketResponse | null;
  try {
    data = await load((await params).id);
  } catch (e) {
    return e instanceof SlowDown ? { title: "Market", robots: { index: false } } : { title: "Market" };   // RT3-02: never index the slow-down state
  }
  if (!data) return { title: "Market" };
  const m = data.market;
  return { title: m.question, description: `${betLine(m.best)} · ${sideRet(m.best)} estimated return, based on past results. Market analytics, not financial advice.` };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { side }] = await Promise.all([params, searchParams]);
  let data: MarketResponse | null;
  try {
    data = await load(id);
  } catch (e) {
    if (e instanceof SlowDown) return <div className="mx-auto w-full max-w-[720px]"><SlowDownState /></div>;
    return <div className="mx-auto w-full max-w-[720px]"><PendingState line={pendingLine(e)} /></div>;   // a missing store is not a missing market
  }
  if (!data) notFound();
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Suspense>
        <MarketDetail id={id} side={side === "0" ? 0 : side === "1" ? 1 : undefined} initial={data} />
      </Suspense>
    </div>
  );
}
