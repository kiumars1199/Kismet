"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_TABS, isActive } from "./nav";
import { SearchBox } from "./SearchBox";
import { FreshnessPill } from "@/components/header/FreshnessPill";
import { Bell } from "@/components/header/Bell";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-heading text-[19px] font-bold">
      <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-accent">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="2.6" aria-hidden="true">
          <path d="M3 17l6-6 4 4 8-8" />
        </svg>
      </span>
      MarketEdge
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
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
              className={`rounded-[10px] px-3.5 py-2 ${active ? "bg-accent/15 text-text" : "text-muted hover:text-text"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-[1_1_260px] items-center justify-end gap-3">
        <SearchBox />
        <Link href="/about" aria-current={pathname === "/about" ? "page" : undefined} className="hidden whitespace-nowrap text-sm text-muted hover:text-text lg:block">How it works</Link>
        <FreshnessPill />
        <Bell />
      </div>
    </header>
  );
}
