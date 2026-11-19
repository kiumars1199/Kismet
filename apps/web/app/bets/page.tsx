import { OnboardingNudge } from "@/components/onboarding/OnboardingNudge";
import { BestBets } from "@/components/screener/BestBets";
import { flagsFirstPage } from "@/lib/data/respond";

export const metadata = { title: { absolute: "Best bets · Kismet" }, description: "Contracts priced below how often similar bets have won, after fees and the spread." };

type Search = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0]! : v]])));
  const initial = await flagsFirstPage(params);   // P6: page 1 ships with the HTML; same body as /api/flags
  return (
    // min-h: the footer starts below the fold, so cards arriving after hydration don't shift it (CLS)
    <div className="mx-auto flex min-h-svh w-full max-w-[1400px] flex-col gap-4">
      <OnboardingNudge />
      {/* no Suspense: the page is dynamic (searchParams), and a boundary here made React hold the reveal of the
          server-rendered cards for up to 300 ms, which Lighthouse counted as a late LCP */}
      <BestBets initial={initial} />
    </div>
  );
}
