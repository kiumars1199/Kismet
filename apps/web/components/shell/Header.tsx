"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BETA_LINKS, MAIN_TABS, isActive } from "./nav";
import { BetaBadge } from "@/components/beta/BetaBadge";
import { useEntitlements } from "@/lib/entitlements";
import { SearchCombobox } from "@/components/search/SearchCombobox";
import { FreshnessPill } from "@/components/header/FreshnessPill";
import { Bell } from "@/components/header/Bell";
import { AccountLink } from "@/components/auth/AccountLink";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-heading text-[19px] font-bold tracking-[-0.01em]">
      {/* Mark: the Space Grotesk Bold "K" of the wordmark as a path, so it matches app/icon.svg at every size */}
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path fill="var(--on-accent)" d="M9.15 25V7H12.55V14.15H13.01L18.85 7H23.19L15.68 15.87L23.45 25H18.97L13.01 17.7H12.55V25Z" />
      </svg>
      Kismet
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { canBeta } = useEntitlements();
  return (
    <header className="flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-border px-4 py-3 md:px-8 md:py-4">
      <Logo />
      <nav aria-label="Main" className="hidden gap-1 md:flex md:flex-wrap">
        {MAIN_TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-[10px] px-3.5 py-2 transition-colors duration-200 ease-out ${active ? "bg-nav-active text-text" : "text-muted hover:bg-muted-bg hover:text-text"}`}
            >
              {t.label}
            </Link>
          );
        })}
        {BETA_LINKS.filter((l) => canBeta(l.feature)).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 transition-colors duration-200 ease-out ${isActive(pathname, l.href) ? "bg-nav-active text-text" : "text-muted hover:bg-muted-bg hover:text-text"}`}
          >
            {l.label} <BetaBadge variant="pill" />
          </Link>
        ))}
      </nav>
      <div className="flex flex-[1_1_260px] items-center justify-end gap-2 sm:gap-3">
        <SearchCombobox />
        <Link href="/about" aria-current={pathname === "/about" ? "page" : undefined} className="hidden whitespace-nowrap text-sm text-muted hover:text-text lg:block">How it works</Link>
        <FreshnessPill />
        <Bell />
        <AccountLink />
      </div>
    </header>
  );
}
