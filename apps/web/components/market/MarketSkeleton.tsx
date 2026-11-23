// Placeholder while <MarketDetail> streams in on /m/<id>. Without a sized fallback the footer painted near the top and
// was pushed down when the page arrived (CLS 0.15 to 0.6 on cold loads). Shapes only: a title block, the bet button and
// its line, the figures card, the two sides and a "why" card; at least the viewport tall so the footer starts below the fold.
export function MarketSkeleton() {
  const bar = "animate-pulse rounded-input bg-muted-bg";
  return (
    <div data-skeleton role="status" aria-live="polite" className="flex min-h-[100svh] w-full flex-col gap-4">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="space-y-2">
        <div className={`h-4 w-40 ${bar}`} />
        <div className={`h-[70px] w-full ${bar}`} />
      </div>
      <div aria-hidden="true" className={`h-12 w-full rounded-xl ${bar}`} />
      <div aria-hidden="true" className="h-[220px] w-full animate-pulse rounded-card bg-muted-bg" />
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <div className="h-[84px] animate-pulse rounded-card bg-muted-bg" />
        <div className="h-[84px] animate-pulse rounded-card bg-muted-bg" />
      </div>
      <div aria-hidden="true" className="h-[260px] w-full animate-pulse rounded-card bg-muted-bg" />
    </div>
  );
}
