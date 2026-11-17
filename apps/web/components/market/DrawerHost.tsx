"use client";

// Owner: Lane C (T-23 MarketDrawer). Mounted once in the app shell; replace the placeholder body only.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

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

  useEffect(() => {
    if (!marketId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marketId, close]);

  if (!marketId) return null;
  return (
    <aside role="dialog" aria-label="Market details" className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-6 md:inset-y-0 md:left-auto md:w-[440px]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">Market {marketId}{side !== undefined ? ` · side ${side}` : ""}</h2>
        <button type="button" onClick={close} aria-label="Close" className="flex size-11 flex-none items-center justify-center rounded-card bg-raised text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <p className="text-muted">Market details are coming soon.</p>
    </aside>
  );
}
