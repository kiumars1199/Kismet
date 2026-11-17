"use client";

// Owner: Lane C (T-23 MarketDrawer). Mounted once in the app shell. URL contract: ?m=<market id>&side=<0|1>.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { MarketDetail } from "./MarketDetail";

/** Query string that opens the drawer, keeping the other params of `current` (e.g. the screener filters). */
export function drawerHref(marketId: string, side?: 0 | 1, current?: string | URLSearchParams): string {
  const p = new URLSearchParams(current);
  p.set("m", marketId);
  if (side === undefined) p.delete("side");
  else p.set("side", String(side));
  return `?${p}`;
}

/** Open / close the drawer from any page: `const { open, close } = useOpenDrawer()`. */
export function useOpenDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = useCallback(
    (marketId: string, side?: 0 | 1) => router.push(pathname + drawerHref(marketId, side, params), { scroll: false }),
    [router, pathname, params],
  );
  const close = useCallback(() => {
    const p = new URLSearchParams(params);
    p.delete("m");
    p.delete("side");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, params]);
  return { open, close };
}

export function DrawerHost() {
  const params = useSearchParams();
  const { close } = useOpenDrawer();
  const marketId = params.get("m");
  const sideParam = params.get("side");
  const side = sideParam === "0" ? 0 : sideParam === "1" ? 1 : undefined;

  const panel = useRef<HTMLDivElement>(null);
  // focus the drawer when it opens or switches market; return focus on close
  useEffect(() => {
    if (!marketId) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.scrollTo(0, 0);
    panel.current?.focus();
    return () => prev?.focus?.();
  }, [marketId]);

  useEffect(() => {
    if (!marketId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marketId, close]);

  if (!marketId) return null;
  return (
    <>
      <div aria-hidden="true" onClick={close} className="fixed inset-0 z-40 hidden bg-black/50 md:block" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Market details"
        className="fixed inset-0 z-50 overflow-y-auto focus:outline-none overscroll-contain border-l border-border bg-surface p-5 pb-10 md:inset-y-0 md:left-auto md:w-[460px] md:p-[26px]"
      >
        <MarketDetail id={marketId} side={side} onClose={close} />
      </div>
    </>
  );
}
