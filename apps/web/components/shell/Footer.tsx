import Link from "next/link";

export const DISCLAIMER = "Market analytics, not financial advice. Based on past results. 18+.";

// Rendered on every page (CLAUDE.md rule 5). Bottom padding on mobile clears the tab bar.
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 pb-24 pt-5 text-xs text-muted md:px-8 md:pb-5">
      <p>{DISCLAIMER}</p>
      <nav aria-label="Legal" className="flex gap-1">
        <Link href="/about" className="px-1 hover:text-text">How it works</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="px-1 hover:text-text">Terms</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="px-1 hover:text-text">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/status" className="px-1 hover:text-text">Status</Link>
      </nav>
    </footer>
  );
}
