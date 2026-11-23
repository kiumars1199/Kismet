// Shareable market page (T-25): the drawer's content as a page, server-rendered from the store.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import type { MarketResponse } from "@/lib/api";
import { SlowDown, liveMarketBody, pageBudget, pageStore, pendingLine } from "@/lib/data/respond";
import { PendingState } from "@/components/screener/States";
import { SlowDownState } from "@/components/screener/SlowDownState";
import { betLine, cleanEventLine, sideRet } from "@/lib/format";
import { MarketDetail } from "@/components/market/MarketDetail";
import { actionReserve } from "@/lib/trade/reserve";
import { InviteRef } from "@/components/share/InviteRef";
import { MarketSkeleton } from "@/components/market/MarketSkeleton";
import { TeaserView } from "@/components/market/Teaser";
import { requestZone } from "@/lib/zone-server";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { topicCrumb } from "@/components/market/labels";
import { authEnabled, getUser } from "@/lib/auth/server";
import { TEASER_DESCRIPTION, marketTeaser } from "@/lib/teaser";
import { shareableFacts } from "@/lib/share/card-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ side?: string; s?: string; sig?: string }> };

// T-44: same tier shaping as /api/markets/[id]; RT3-02: same rate limit, plus the Free row budget. cache(): the
// metadata and the page share one load (one count) per request.
const load = cache(async (id: string): Promise<MarketResponse | null> => {
  const ctx = await pageStore();
  const m = ctx.store.flagsById.get(id) ?? ctx.store.byId.get(id);
  if (!m) return null;
  await pageBudget(ctx, [m.id]);
  return liveMarketBody(ctx.store, m, ctx.tier);
});

// T-276: signed out (with accounts on), the page is a teaser: title, category, closing time, sign up. No model output.
const teaser = cache(async () => authEnabled() && !(await getUser()));

/** F13: the link preview is the public share image. A link a signed-in person shared carries `s` (side) and `sig`; the
 *  image shows the Free-banded numbers only for a valid signature, so the description says the same: the numbers line
 *  for a valid signature, the sign-up line otherwise. */
const preview = async (id: string, title: string, fallback: string, sp: { s?: string; sig?: string }): Promise<Metadata> => {
  const side = Number(sp.s);
  // the same rule as the image: a valid signature on a flagged bet
  const facts = typeof sp.sig === "string" && Number.isInteger(side) ? await shareableFacts(id, side, sp.sig) : null;
  const signed = !!facts;
  const description = facts && (facts.mult || facts.chance)
    ? `${[facts.mult && `Pays ${facts.mult}`, facts.chance].filter(Boolean).join(" · ")}. Market analytics, not financial advice.`
    : fallback;
  const url = `/api/og/bet/${encodeURIComponent(id)}${signed ? `?s=${side}&sig=${encodeURIComponent(sp.sig!)}` : ""}`;
  const images = [{ url, width: 1200, height: 630, alt: title }];
  return { title, description, openGraph: { title, description, type: "website", images }, twitter: { card: "summary_large_image", title, description, images: [url] } };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  if (await teaser()) {
    const id = (await params).id;
    const t = await marketTeaser(id).catch(() => null);
    return t ? preview(id, t.title, TEASER_DESCRIPTION, sp) : { title: "Market" };
  }
  let data: MarketResponse | null;
  try {
    data = await load((await params).id);
  } catch (e) {
    return e instanceof SlowDown ? { title: "Market", robots: { index: false } } : { title: "Market" };   // RT3-02: never index the slow-down state
  }
  if (!data) return { title: "Market" };
  const m = data.market;
  return preview(m.id, m.question, `${betLine(m.best)} · ${sideRet(m.best)} estimated return, based on past results. Market analytics, not financial advice.`, sp);
}

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { side }] = await Promise.all([params, searchParams]);
  if (await teaser()) {
    let t: Awaited<ReturnType<typeof marketTeaser>>;
    try {
      t = await marketTeaser(id);
    } catch (e) {
      return <div className="mx-auto w-full max-w-[720px]"><PendingState line={pendingLine(e)} /></div>;   // no store yet is not a missing page
    }
    if (!t) notFound();
    return <><InviteRef /><TeaserView t={t} path={`/m/${encodeURIComponent(id)}`} zone={await requestZone()} /></>;   // F13: ?ref=<code> remembers the sharer
  }
  let data: MarketResponse | null;
  try {
    data = await load(id);
  } catch (e) {
    if (e instanceof SlowDown) return <div className="mx-auto w-full max-w-[720px]"><SlowDownState /></div>;
    return <div className="mx-auto w-full max-w-[720px]"><PendingState line={pendingLine(e)} /></div>;   // a missing store is not a missing market
  }
  if (!data) notFound();
  const m = data.market;
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Breadcrumbs className="mb-3" items={[{ label: "Best bets", href: "/bets" }, topicCrumb(m), ...(m.event && m.event !== m.question ? [{ label: cleanEventLine(m.event), href: `/event/${encodeURIComponent(m.event_id)}` }] : []), { label: m.question }]} />
      <Suspense fallback={<MarketSkeleton />}>
        <MarketDetail id={id} side={side === "0" ? 0 : side === "1" ? 1 : undefined} initial={data} reserve={await actionReserve()} />
      </Suspense>
    </div>
  );
}
