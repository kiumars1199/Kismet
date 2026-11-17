// POST /api/settle  body { ids: string[] } (Polymarket market ids from the local My bets journal)
// → { [id]: { resolved, winner_side_index: 0|1|null, closing_prices: [p0|null, p1|null] } }
// Demo-mode settlement (docs/05 F-12, docs/10 demo deltas). winner null + resolved = void (50/50).
// closing price = each side's last trade price before the market's end (CLOB prices-history), for CLV.
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/abuse";
import { sameOrigin } from "@/lib/auth/server";
import type { Settlement } from "@/lib/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const TTL_MS = 10 * 60_000;
const MAX_IDS = 200;


// ponytail: per-instance memory cache; resolved results never change, open ones re-check after TTL
const cache = new Map<string, { at: number; v: Settlement }>();
const OPEN: Settlement = { resolved: false, winner_side_index: null, closing_prices: [null, null] };

const arr = (x: unknown): string[] => {
  if (Array.isArray(x)) return x.map(String);
  try { const v = JSON.parse(String(x)); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
};

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function closingPrice(token: string | undefined, endSec: number): Promise<number | null> {
  if (!token) return null;
  try {
    const { history } = await json<{ history?: { t: number; p: number }[] }>(
      `${CLOB}/prices-history?${new URLSearchParams({ market: token, interval: "max", fidelity: "60" })}`);
    const before = (history ?? []).filter((h) => h.t <= endSec && Number.isFinite(h.p));
    return before.length ? before[before.length - 1]!.p : null;
  } catch {
    return null; // CLV skipped when history is unavailable
  }
}

async function settleOne(id: string): Promise<Settlement> {
  const hit = cache.get(id);
  if (hit && (hit.v.resolved || Date.now() - hit.at < TTL_MS)) return hit.v;
  try {
    const m = await json<Record<string, unknown>>(`${GAMMA}/markets/${encodeURIComponent(id)}`);
    const prices = arr(m.outcomePrices).map(Number);
    const closed = m.closed === true;
    const uma = String(m.umaResolutionStatus ?? "");
    const resolved = closed && prices.length === 2 && (uma === "" || uma === "resolved") &&
      (prices.some((p) => p >= 0.99) || prices.every((p) => Math.abs(p - 0.5) < 0.01));
    let v: Settlement = OPEN;
    if (resolved) {
      const win = prices.findIndex((p) => p >= 0.99);
      const end = Date.parse(String(m.endDate ?? m.closedTime ?? "")) / 1000;
      const closedAt = Date.parse(String(m.closedTime ?? "").replace(" ", "T").replace(/\+00$/, "Z")) / 1000;
      const cutoff = Math.min(...[end, closedAt].filter(Number.isFinite), Date.now() / 1000);
      const tokens = arr(m.clobTokenIds);
      const [c0, c1] = await Promise.all([closingPrice(tokens[0], cutoff), closingPrice(tokens[1], cutoff)]);
      v = { resolved: true, winner_side_index: win === 0 || win === 1 ? win : null, closing_prices: [c0, c1] };
    }
    cache.set(id, { at: Date.now(), v });
    return v;
  } catch {
    return OPEN; // unknown market or Gamma down: try again next load
  }
}

// docs/15: unknown keys rejected; ids are path-safe before they reach the Gamma URL.
const Body = z.object({ ids: z.array(z.string().regex(/^[\w-]{1,80}$/)).max(1_000) }).strict();

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const limited = await rateLimit("book", clientKey(req));
  if (limited) return limited;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "body must be { ids: string[] }" }, { status: 400 });
  const unique = [...new Set(body.data.ids)].slice(0, MAX_IDS);
  const out: Record<string, Settlement> = {};
  // ponytail: 8 concurrent Gamma calls; fine for a personal journal
  for (let i = 0; i < unique.length; i += 8) {
    const chunk = unique.slice(i, i + 8);
    const res = await Promise.all(chunk.map(settleOne));
    chunk.forEach((id, j) => { out[id] = res[j]!; });
  }
  return Response.json(out);
}
