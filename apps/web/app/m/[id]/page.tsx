// Shareable market page (T-25): the drawer's content as a page, server-rendered from the store.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { MarketResponse } from "@/lib/api";
import { getTier } from "@/lib/auth/server";
import { marketBody } from "@/lib/data/respond";
import { getStoreFor } from "@/lib/data/store";
import { betLine, sideRet } from "@/lib/format";
import { MarketDetail } from "@/components/market/MarketDetail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ side?: string }> };

async function load(id: string): Promise<MarketResponse | null> {
  const tier = await getTier();   // T-44: same tier shaping as /api/markets/[id]
  const store = await getStoreFor(tier);
  const m = store.flagsById.get(id) ?? store.byId.get(id);
  return m ? marketBody(store, m, tier) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).id).catch(() => null);
  if (!data) return { title: "Market" };
  const m = data.market;
  return { title: m.question, description: `${betLine(m.best)} · ${sideRet(m.best)} expected return. Market analytics, not financial advice.` };
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
