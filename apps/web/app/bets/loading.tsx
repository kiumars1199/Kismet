import { cookies } from "next/headers";
import { PageSkeleton } from "@/components/shell/PageSkeleton";
import { MAX_RESERVE, MIN_RESERVE, REMEMBER_COOKIE } from "./remember";

// T-wt3l: Back to /bets (or a reload) restores the scroll position. While this skeleton is the page, a 100svh page is too short to scroll to it, so
// the browser clamps (the footer sits in view), then the real list arrives and the restored position applies: the footer shot down the page
// (CLS 0.55 at 390, 0.21 at 1440). The skeleton reserves the height of the list the user left (RememberHeight reports it, /api/bets/height keeps it
// in a cookie): at least 12,000 px, at most 80,000 (a 50-bet Premium page is ~26,000 px at 390 here, ~33,000 in production). The reserve exists
// only while this skeleton shows: the real list replaces it, so a shorter list leaves no blank below the footer. The shapes repeat down the
// reserve, so a restored scroll past them is not a blank screen.
export default async function Loading() {
  const saved = Number((await cookies()).get(REMEMBER_COOKIE)?.value);
  const reserve = Number.isFinite(saved) && saved > MIN_RESERVE ? Math.min(Math.round(saved), MAX_RESERVE) : MIN_RESERVE;
  return (
    <div className="relative" style={{ minHeight: reserve }}>
      <PageSkeleton rows={6} />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 top-[900px] mx-auto w-full max-w-5xl opacity-70"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, var(--muted-bg) 0 112px, transparent 112px 128px)" }}
      />
    </div>
  );
}
