// Placeholder while <EventView> streams in on /event/<id>. Without a sized fallback the footer painted near the top
// and was pushed down in one ~0.43 shift at 390 px. This holds the page's height: a header block, then one placeholder
// per market (up to 8; a card on a phone, a table row from md up), never shorter than the viewport so the footer
// starts below the fold and nothing visible moves when the view arrives.
export function EventSkeleton({ rows }: { rows: number }) {
  const n = Math.min(Math.max(rows, 3), 8);
  return (
    <div data-skeleton role="status" aria-live="polite" className="mx-auto flex min-h-[100svh] w-full max-w-[1400px] flex-col gap-5">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="space-y-3">
        <div className="h-5 w-64 max-w-full animate-pulse rounded-input bg-muted-bg" />
        <div className="h-4 w-40 animate-pulse rounded-input bg-muted-bg" />
        <div className="h-[70px] w-full animate-pulse rounded-input bg-muted-bg md:h-[42px] md:max-w-xl" />
        <div className="h-10 w-full animate-pulse rounded-input bg-muted-bg" />
      </div>
      <ul aria-hidden="true" className="flex flex-col gap-2.5">
        {Array.from({ length: n }, (_, i) => <li key={i} className="h-[132px] animate-pulse rounded-xl bg-muted-bg md:h-14" />)}
      </ul>
    </div>
  );
}
