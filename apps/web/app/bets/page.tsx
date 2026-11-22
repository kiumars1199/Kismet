import { OnboardingNudge } from "@/components/onboarding/OnboardingNudge";
import { BestBets } from "@/components/screener/BestBets";
import { firstPage } from "@/lib/data/respond";
import { authEnabled, getUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { markFirstBetsVisit, nudgeOnServer, topicsRedirect } from "@/lib/activation";

export const metadata = { title: { absolute: "Best bets · Kismet" }, description: "Bets that have won more often in the past than their price suggests, after the fee." };

type Search = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0]! : v]])));
  const user = await getUser();
  const to = await topicsRedirect(user?.id ?? null, params.toString());
  if (to) redirect(`/bets${to}`);   // F5: open on the user's topics; decided here so the first HTML already has them
  const initial = await firstPage(params, "flags");   // P6: page 1 + Closing soon ship with the HTML
  if (user) markFirstBetsVisit(user.id);   // T-276: admin activation count (first visit only)
  const nudge = await nudgeOnServer(user?.id ?? null, !authEnabled());
  return (
    // min-h: the footer starts below the fold, so cards arriving after hydration don't shift it (CLS)
    <div className="mx-auto flex min-h-svh w-full max-w-[1400px] flex-col gap-4">
      <OnboardingNudge initial={nudge} />
      {/* no Suspense: the page is dynamic (searchParams), and a boundary here made React hold the reveal of the
          server-rendered cards for up to 300 ms, which Lighthouse counted as a late LCP */}
      <BestBets initial={initial} />
    </div>
  );
}
