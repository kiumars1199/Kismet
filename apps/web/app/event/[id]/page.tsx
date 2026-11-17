import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eventBody } from "@/lib/data/respond";
import { getStore } from "@/lib/data/store";
import { EventView } from "@/components/screener/EventView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const store = await getStore();
  const markets = store.byEvent.get(id);
  return markets ? eventBody(store, markets) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ev = await load((await params).id).catch(() => null);
  return { title: ev?.event ?? "Event" };
}

export default async function Page({ params }: Props) {
  const ev = await load((await params).id);
  if (!ev) notFound();
  return (
    <Suspense>
      <EventView ev={ev} />
    </Suspense>
  );
}
