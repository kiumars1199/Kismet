"use client";

import Form from "next/form";
import { useEffect, useRef } from "react";

// Header search: submits to /markets?q=… ; "/" focuses it (docs/05 F-02). Lane C (T-22) may enrich it.
export function SearchBox() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Form action="/markets" role="search" className="w-full max-w-[300px]">
      <label className="flex items-center gap-2.5 rounded-card border border-border bg-surface px-3.5 py-2 text-muted focus-within:border-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Search markets</span>
        <input
          ref={ref}
          name="q"
          type="search"
          maxLength={120}
          placeholder="Search a team, city or topic"
          className="w-full bg-transparent text-text placeholder:text-muted focus:outline-none"
        />
        <kbd className="hidden rounded border border-border px-1.5 text-xs md:inline" aria-hidden="true">/</kbd>
      </label>
    </Form>
  );
}
