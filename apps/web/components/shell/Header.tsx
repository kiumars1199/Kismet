"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BETA_LINKS, MAIN_TABS, SALES_TABS, isActive } from "./nav";
import { useMe } from "@/lib/me";
import { BetaBadge } from "@/components/beta/BetaBadge";
import { useEntitlements } from "@/lib/entitlements";
import dynamic from "next/dynamic";
import { FreshnessPill } from "@/components/header/FreshnessPill";
import { AccountLink } from "@/components/auth/AccountLink";

export function Logo() {
  return (
    <Link href="/" className="flex flex-none items-center gap-2 font-heading text-lg font-bold tracking-[-0.01em]">
      {/* Mark: the Space Grotesk Bold "K" of the wordmark as a path, so it matches app/icon.svg at every size */}
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path fill="var(--on-accent)" d="M9.15 25V7H12.55V14.15H13.01L18.85 7H23.19L15.68 15.87L23.45 25H18.97L13.01 17.7H12.55V25Z" />
      </svg>
      Kismet
    </Link>
  );
}

// T-295: own chunks, loaded only where they render (never on the signed-out pages: the landing stays light).
// ssr: false, because a server-rendered next/dynamic adds a <link rel=preload> without the CSP nonce, which
// 'strict-dynamic' blocks (a console violation on every signed-in page). The placeholders are the same size as the
// real thing (the search box's own Suspense fallback; the bell's 44 px button), so the header does not move.
const SearchCombobox = dynamic(() => import("@/components/search/SearchCombobox").then((m) => m.SearchCombobox), {
  ssr: false,
  loading: () => <div className="h-[42px] w-full max-w-[340px] rounded-input border border-border bg-input" />,
});
const Bell = dynamic(() => import("@/components/header/Bell").then((m) => m.Bell), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="size-11" />,
});

const navItem = (active: boolean) =>
  `relative flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-input px-3 text-sm transition-colors ${active
    ? "bg-nav-active font-medium text-text"
    : "text-muted hover:bg-muted-bg hover:text-text"}`;

// P7: one row from lg up, sticky there (persistent nav, clear current page: filled tab + aria-current); phones keep
// the bottom tab bar (MobileNav) and a non-sticky top row so the list gets the height.
export function Header({ signedOutHint = false }: { signedOutHint?: boolean }) {
  const pathname = usePathname();
  const { canBeta } = useEntitlements();
  const me = useMe();
  // T-276: signed out, the app tabs, search and alerts all lead to the sign-up wall, so show the sales pages.
  // Until /api/me answers, the layout's hint (accounts on, no session cookie: T-295) decides.
  const signedOut = me ? !!me.auth && !me.user : signedOutHint;
  const tabs = signedOut ? SALES_TABS : MAIN_TABS;
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-background px-4 py-3 md:px-8 lg:sticky lg:top-0 lg:z-30 lg:h-16 lg:flex-nowrap lg:py-0">
      <Logo />
      <nav aria-label="Main" className="hidden min-w-0 items-center gap-1 md:flex lg:overflow-x-auto lg:[scrollbar-width:none]">
        {tabs.map((t) => {
          const active = signedOut ? pathname === t.href : isActive(pathname, t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={navItem(active)}>
              {t.label}
            </Link>
          );
        })}
        {BETA_LINKS.filter((l) => canBeta(l.feature)).map((l) => (
          <Link key={l.href} href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined} className={navItem(isActive(pathname, l.href))}>
            {l.label} <BetaBadge variant="pill" />
          </Link>
        ))}
      </nav>
      {/* Signed out there is no search, so the right side fits next to the logo on a phone: no 260 px basis, and the
          freshness dot waits for sm+ (the landing hero states the scan time itself). */}
      <div className={`flex items-center justify-end gap-2 lg:flex-1 ${signedOut ? "flex-1" : "flex-[1_1_260px]"}`}>
        {!signedOut && <SearchCombobox />}
        {signedOut ? <span className="contents max-sm:hidden"><FreshnessPill /></span> : <FreshnessPill />}
        {!signedOut && <Bell />}
        <AccountLink signedOutHint={signedOutHint} />
      </div>
    </header>
  );
}
