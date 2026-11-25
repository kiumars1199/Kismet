"use client";
// T-wt3l: instant feedback on a tab tap. /bets has no loading.tsx (its boundary streamed the list after the footer, which moved the page on Back), so
// the tap needs another sign that it was received: a pulsing accent bar on the tapped tab while the next page loads. useLinkStatus is `pending` from the
// tap until the navigation commits; the bar takes no layout space (absolute) and is gone on arrival. Must be a child of the <Link>.
import { useLinkStatus } from "next/link";

export function LinkPending({ className }: { className: string }) {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden="true" data-pending className={`pointer-events-none absolute animate-pulse rounded-full bg-accent ${className}`} /> : null;
}
