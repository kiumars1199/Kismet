"use client";

import Form from "next/form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { fetchEventBySlug } from "@/lib/api";
import { SLUG_URL } from "@/lib/data/search";

// Header search (docs/05 F-02): "/" focuses it. On /markets it filters live (200 ms debounce, merged into the
// URL with the other filters); elsewhere it submits to /markets?q=…. A pasted Polymarket URL jumps to the market.
export function SearchBox() {
  return (
    <Suspense fallback={<Shell />}>
      <Search />
    </Suspense>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 rounded-card border border-border bg-surface px-3.5 py-2 text-muted focus-within:border-accent">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span className="sr-only">Search markets</span>
      {children ?? <input type="search" disabled placeholder="Search a team, city or topic" className="w-full bg-transparent placeholder:text-muted" />}
      <kbd className="hidden rounded border border-border px-1.5 text-xs md:inline" aria-hidden="true">/</kbd>
    </label>
  );
}

function Search() {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const live = pathname === "/markets";
  const urlQ = params.get("q") ?? "";
  const [text, setText] = useState(urlQ);
  const [note, setNote] = useState("");

  useEffect(() => setText(urlQ), [urlQ]);

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

  // live filtering on /markets
  useEffect(() => {
    if (!live || text === urlQ || SLUG_URL.test(text)) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(params);
      if (text.trim()) p.set("q", text.trim().slice(0, 120));
      else p.delete("q");
      p.delete("pg");
      router.replace(`/markets${p.size ? `?${p}` : ""}`, { scroll: false });
    }, 200);
    return () => clearTimeout(t);
  }, [text, live, urlQ, params, router]);

  const jump = async (raw: string) => {
    const slug = SLUG_URL.exec(raw)?.[1];
    if (!slug) return false;
    setNote("Finding that market…");
    try {
      const ev = await fetchEventBySlug(slug.toLowerCase());
      const best = ev.markets[0];
      if (!best) throw new Error("empty");
      setNote("");
      router.push(`/markets?q=${encodeURIComponent(ev.slug)}&m=${best.id}&side=${best.best.side_index}`);
    } catch {
      setNote("That market isn't open in our scan.");
    }
    return true;
  };

  return (
    <Form
      action="/markets"
      role="search"
      className="relative w-full max-w-[300px]"
      onSubmit={(e) => {
        if (SLUG_URL.test(text)) {
          e.preventDefault();
          void jump(text);
        } else if (live) e.preventDefault();
      }}
    >
      <Shell>
        <input
          ref={ref}
          name="q"
          type="search"
          maxLength={500}
          value={text}
          onChange={(e) => {
            setNote("");
            setText(e.target.value);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (SLUG_URL.test(pasted)) {
              e.preventDefault();
              setText(pasted);
              void jump(pasted);
            }
          }}
          placeholder="Search a team, city or topic"
          className="w-full bg-transparent text-text placeholder:text-muted focus:outline-none"
        />
      </Shell>
      {note && <p role="status" className="absolute left-0 top-full z-30 mt-1 rounded-input border border-border bg-raised px-3 py-1.5 text-xs text-soft">{note}</p>}
    </Form>
  );
}
