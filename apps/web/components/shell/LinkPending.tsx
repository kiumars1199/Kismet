"use client";
// T-wt3l: instant feedback on a tab tap. /bets has no loading.tsx (its boundary streamed the list after the footer, which moved the page on Back), so
// the tap needs another sign that it was received: a pulsing mark on the tapped tab while the next page loads, and, for a link to /bets (`skeleton`),
// a /bets-shaped placeholder in place of the current page (globals.css, data-bets-pending on <html>), tall enough to push the footer out of view inside
// Chrome's 500 ms input window. useLinkStatus is `pending` from the tap until the navigation commits or another one replaces it; both clear then.
// The mark takes no layout space (absolute). Must be a child of the <Link>.
import { useEffect } from "react";
import { useLinkStatus } from "next/link";

export function LinkPending({ className, skeleton }: { className: string; skeleton?: boolean }) {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending || !skeleton) return;
    const root = document.documentElement;
    root.setAttribute("data-bets-pending", "");
    return () => root.removeAttribute("data-bets-pending");
  }, [pending, skeleton]);
  return pending ? <span aria-hidden="true" data-pending className={`pointer-events-none absolute animate-pulse bg-accent ${className}`} /> : null;
}
