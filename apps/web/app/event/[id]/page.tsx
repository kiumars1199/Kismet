import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { SlowDown, eventBody, pageBudget, pageStore, pendingLine } from "@/lib/data/respond";
import { PendingState } from "@/components/screener/States";
import { SlowDownState } from "@/components/screener/SlowDownState";
import { EventView } from "@/components/screener/EventView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// RT3-02: the /api/events/[id] rate limit plus the Free row budget; cache(): metadata and page count once per request.
const load = cache(async (id: string) => {
  const ctx = await pageStore();
  const markets = ctx.store.byEvent.get(id);
  const ev = markets ? eventBody(ctx.store, markets, ctx.tier) : null;
  if (ev) await pageBudget(ctx, ev.markets.map((m) => m.id));
  return ev;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    return { title: (await load((await params).id))?.event ?? "Event" };
  } catch (e) {
    return e instanceof SlowDown ? { title: "Event", robots: { index: false } } : { title: "Event" };   // RT3-02: never index the slow-down state
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  let ev: Awaited<ReturnType<typeof load>>;
  try {
    ev = await load(id);
  } catch (e) {
    if (e instanceof SlowDown) return <div className="mx-auto w-full max-w-[720px]"><SlowDownState /></div>;
    return <div className="mx-auto w-full max-w-[720px]"><PendingState line={pendingLine(e)} /></div>;   // a missing store is not a missing event
  }
  if (!ev) notFound();
  return (
    <Suspense>
      <EventView ev={ev} />
    </Suspense>
  );
}
