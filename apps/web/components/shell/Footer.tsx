import Link from "next/link";
import { LEGAL_PAGES } from "@/components/legal/Legal";
import { SITE } from "@/lib/site";

export const DISCLAIMER = "Market analytics, not financial advice. Based on past results. 18+.";

// Rendered on every page (CLAUDE.md rule 5, docs/14 §3). Bottom padding on mobile clears the tab bar.
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 pb-24 pt-5 text-xs text-muted md:px-8 md:pb-5">
      <div className="flex flex-col gap-1">
        <p>{DISCLAIMER}</p>
        <p>© {new Date().getFullYear()} {SITE.operator}</p>
      </div>
      <nav aria-label="Site" className="-mx-2 flex flex-wrap gap-x-0.5 md:-mx-1 md:gap-x-2 md:gap-y-1">
        {[{ href: "/about", label: "How it works" }, { href: "/pricing", label: "Pricing" }, ...LEGAL_PAGES, { href: "/status", label: "Status" }].map((p) => (
          <Link key={p.href} href={p.href} className="inline-flex min-h-11 items-center px-2 hover:text-text md:min-h-0 md:px-1 md:py-0.5">{p.label}</Link>
        ))}
      </nav>
    </footer>
  );
}
