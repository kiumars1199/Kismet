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
      <nav aria-label="Legal" className="-mx-1 flex flex-wrap gap-x-2 gap-y-1">
        {[{ href: "/about", label: "How it works" }, ...LEGAL_PAGES, { href: "/status", label: "Status" }].map((p) => (
          <Link key={p.href} href={p.href} className="px-1 py-0.5 hover:text-text">{p.label}</Link>
        ))}
      </nav>
    </footer>
  );
}
