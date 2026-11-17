"use client";

// Screener state: the URL is the only source of truth (lib/filters/url.ts); data comes from lib/api.ts.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFlags, fetchMarkets, fetchMeta, type MarketsResponse, type MetaResponse, type UserParams } from "@/lib/api";
import type { FilterState } from "@/lib/filters/state";
import { parse, serialize } from "@/lib/filters/url";
import { useCollection, useProfile } from "@/lib/repo/hooks";
import type { Verdict } from "@/lib/types";

export type Mode = "markets" | "flags";

/** Best bets = flags whose price check isn't "not worth it", as flat cards. */
export const BEST_BETS_VERDICTS: Verdict[] = ["worth it", "thin"];

export function stateFrom(params: URLSearchParams, mode: Mode): FilterState {
  const s = parse(params);
  if (mode === "markets") return s;
  return {
    ...s,
    view: "flags",
    verdicts: params.has("vd") ? s.verdicts : BEST_BETS_VERDICTS,
    group_by_event: params.has("g") ? s.group_by_event : false,
  };
}

/** Query string for a state on a page; Best bets omits its own defaults so its URL stays short. */
export function queryFor(s: FilterState, mode: Mode): string {
  const p = serialize(s);
  if (mode === "flags") {
    p.delete("view");
    if (p.get("vd") === BEST_BETS_VERDICTS.join(",")) p.delete("vd");
    if (s.group_by_event) p.set("g", "1");
    else p.delete("g");
  }
  const q = p.toString();
  return q ? `?${q}` : "";
}

// Scan meta changes at most once per scan; one request per page load is enough.
let metaPromise: Promise<MetaResponse> | null = null;
export function useMeta() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  useEffect(() => {
    let live = true;
    (metaPromise ??= fetchMeta().catch((e) => ((metaPromise = null), Promise.reject(e))))
      .then((m) => live && setMeta(m))
      .catch(() => {});
    return () => void (live = false);
  }, []);
  return meta;
}

type Result = { key: string; data?: MarketsResponse; more?: MarketsResponse["rows"]; error?: string };

export function useScreener(mode: Mode) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // drawer params (m, side) don't change the list
  const key = useMemo(() => {
    const p = new URLSearchParams(params);
    p.delete("m");
    p.delete("side");
    return p.toString();
  }, [params]);
  const state = useMemo(() => stateFrom(new URLSearchParams(key), mode), [key, mode]);

  const watchlist = useCollection("watchlist");
  const profile = useProfile();
  const user = useMemo<UserParams | undefined>(() => {
    if (!state.watchlisted_only && !state.favorites_only) return undefined;
    return { watchlist: watchlist.map((w) => w.market_id), favorites: profile.favorite_topics };
  }, [state.watchlisted_only, state.favorites_only, watchlist, profile.favorite_topics]);
  const fetchKey = `${mode}?${key}#${user ? JSON.stringify(user) : ""}`;

  const [res, setRes] = useState<Result>({ key: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    (mode === "flags" ? fetchFlags : fetchMarkets)(state, { signal: ac.signal }, user)
      .then((data) => setRes({ key: fetchKey, data }))
      .catch((e) => !ac.signal.aborted && setRes((r) => ({ key: fetchKey, data: r.data, error: String(e?.message ?? e) })));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, retry]);

  const set = useCallback(
    (patch: Partial<FilterState>, opts?: { replace?: boolean }) => {
      const href = pathname + queryFor({ ...state, page: 1, ...patch }, mode);
      if (opts?.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: patch.page ? true : false });
    },
    [state, pathname, mode, router],
  );
  const reset = useCallback(() => router.push(pathname, { scroll: false }), [router, pathname]);

  /** Append the next page without touching the URL (Best bets "Show more"). */
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = useCallback(async () => {
    if (!res.data || loadingMore) return;
    const shown = res.data.page + Math.ceil((res.more?.length ?? 0) / res.data.page_size);
    setLoadingMore(true);
    try {
      const next = await (mode === "flags" ? fetchFlags : fetchMarkets)({ ...state, page: shown + 1 }, undefined, user);
      setRes((r) => (r.key === fetchKey ? { ...r, more: [...(r.more ?? []), ...next.rows] } : r));
    } finally {
      setLoadingMore(false);
    }
  }, [res, loadingMore, mode, state, user, fetchKey]);

  const fresh = res.key === fetchKey;
  return {
    state, set, reset, mode,
    data: res.data,
    more: fresh ? (res.more ?? []) : [],
    loading: !fresh,
    error: fresh ? res.error : undefined,
    retry: () => setRetry((n) => n + 1),
    loadMore, loadingMore,
  };
}
export type Screener = ReturnType<typeof useScreener>;
