import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eventBody, pendingLine } from "@/lib/data/respond";
import { PendingState } from "@/components/screener/States";
import { getTier } from "@/lib/auth/server";
import { getStoreFor } from "@/lib/data/store";
import { EventView } from "@/components/screener/EventView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const tier = await getTier();
  const store = await getStoreFor(tier);
  const markets = store.byEvent.get(id);
  return markets ? eventBody(store, markets, tier) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await load((await params).id).catch(() => null);
  return { title: ev?.event ?? "Event" };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  let ev: Awaited<ReturnType<typeof load>>;
  try {
    ev = await load(id);
  } catch (e) {
    return <div className="mx-auto w-full max-w-[720px]"><PendingState line={pendingLine(e)} /></div>;   // a missing store is not a missing event
  }
  if (!ev) notFound();
  return (
    <Suspense>
      <EventView ev={ev} />
    </Suspense>
  );
}
