import { PageSkeleton } from "@/components/shell/PageSkeleton";

// T-wt3l: Back to /bets (or a reload) restores the scroll position. While this skeleton is the page, a 100svh page is too short to scroll to it, so
// the browser clamps (the footer sits in view), then the real list arrives and the restored position applies: the footer shot down the page
// (CLS 0.55 at 390, 0.21 at 1440). The skeleton reserves a list's worth of height (the longest real list is a few thousand px) so the restored
// position is reachable at once and the footer stays far below the fold both before and after. The extra height is blank; the shapes stay at the top.
export default function Loading() {
  return (
    <div className="min-h-[12000px]">
      <PageSkeleton rows={6} />
    </div>
  );
}
