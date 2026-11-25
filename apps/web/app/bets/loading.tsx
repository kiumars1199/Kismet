import { cookies } from "next/headers";
import { PageSkeleton } from "@/components/shell/PageSkeleton";
import { MAX_RESERVE, MIN_RESERVE, REMEMBER_COOKIE } from "./remember";

// T-wt3l: Back to /bets (or a reload) restores the scroll position. While this skeleton is the page, a 100svh page is too short to scroll to it, so
// the browser clamps (the footer sits in view), then the real list arrives and the restored position applies: the footer shot down the page
// (CLS 0.55 at 390, 0.21 at 1440). The skeleton is exactly as tall as the page the user left: RememberHeight reports the height of the page's own
// root element (what this replaces, no <main> padding) and /api/bets/height keeps it in a cookie; header + this + footer then equals the real page,
// whether it is 3,000 px or 33,000 (a 50-bet Premium page at 390). With nothing remembered the floor is 12,000 px (a few screens of cards); the
// cap is 80,000. The reserve exists only while this skeleton shows, so a shorter list leaves no blank below the footer. Blocks repeat down the
// reserve, so a restored scroll past the top shapes is not a blank screen.
const FIRST = 900, STEP = 128;   // the top shapes' height; one repeated block (h-28 + gap)

export default async function Loading() {
  const saved = Number((await cookies()).get(REMEMBER_COOKIE)?.value);
  const reserve = Number.isFinite(saved) && saved > 0 ? Math.min(Math.round(saved), MAX_RESERVE) : MIN_RESERVE;
  const more = Math.min(Math.max(0, Math.ceil((reserve - FIRST) / STEP)), 640);
  return (
    <div style={{ height: reserve, overflow: "hidden" }}>
      <PageSkeleton rows={6} />
      {more > 0 && (
        <div aria-hidden="true" className="mx-auto w-full max-w-5xl pt-4">
          {Array.from({ length: more }, (_, i) => <div key={i} className="mb-4 h-28 w-full animate-pulse rounded-xl bg-muted-bg" />)}
        </div>
      )}
    </div>
  );
}
