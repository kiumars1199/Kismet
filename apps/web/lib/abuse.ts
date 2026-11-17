// Bot and abuse controls for the expensive and paywalled routes (docs/15 § Bots and abuse):
// Vercel BotID, Upstash sliding-window rate limits keyed by user id (else IP + JA4), and an anomaly log for
// accounts pulling more than 5,000 rows an hour. Server only.
import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkBotId } from "botid/server";

type Window = `${number} ${"s" | "m" | "h"}`;
export const RULES = {
  markets: { limit: 60, window: "1 m" },     // /api/markets, /api/flags, /api/markets/[id], /api/events/*
  pages: { limit: 50, window: "1 m" },       // list pages past the first, per user (docs/15 pagination cap)
  suggest: { limit: 120, window: "1 m" },
  book: { limit: 30, window: "1 m" },
  auth_ip: { limit: 5, window: "1 m" },      // /api/auth/*, per IP
  auth_email: { limit: 5, window: "1 h" },   // magic links, per address
  checkout: { limit: 10, window: "1 h" },
} as const satisfies Record<string, { limit: number; window: Window }>;
export type Rule = keyof typeof RULES;

export const ROWS_PER_HOUR_ALERT = 5_000;

const ms = (w: Window) => {
  const [n, u] = w.split(" ") as [string, "s" | "m" | "h"];
  return Number(n) * { s: 1_000, m: 60_000, h: 3_600_000 }[u];
};

interface Limiter {
  limit(rule: Rule, key: string): Promise<{ ok: boolean; reset: number }>;
  /** Adds n rows to the key's hour; returns the hour's total. */
  rows(key: string, n: number): Promise<number>;
}

/** Sliding-window log in memory (tests; one instance only). */
export function memoryLimiter(now = () => Date.now()): Limiter {
  const hits = new Map<string, number[]>();
  const rows = new Map<string, number>();
  return {
    async limit(rule, key) {
      const { limit, window } = RULES[rule];
      const t = now(), w = ms(window), k = `${rule}:${key}`;
      const list = (hits.get(k) ?? []).filter((x) => x > t - w);
      const ok = list.length < limit;
      if (ok) list.push(t);
      hits.set(k, list);
      return { ok, reset: ok ? t : list[0]! + w };
    },
    async rows(key, n) {
      const k = `${key}:${Math.floor(now() / 3_600_000)}`;
      const total = (rows.get(k) ?? 0) + n;
      rows.set(k, total);
      return total;
    },
  };
}

function upstashLimiter(redis: Redis): Limiter {
  const limiters = Object.fromEntries(Object.entries(RULES).map(([name, r]) => [name, new Ratelimit({
    redis, limiter: Ratelimit.slidingWindow(r.limit, r.window), prefix: `me:rl:${name}`, analytics: false,
  })])) as Record<Rule, Ratelimit>;
  return {
    async limit(rule, key) {
      const r = await limiters[rule].limit(key);
      return { ok: r.success, reset: r.reset };
    },
    async rows(key, n) {
      const k = `me:rows:${key}:${Math.floor(Date.now() / 3_600_000)}`;
      const total = await redis.incrby(k, n);
      if (total === n) await redis.expire(k, 7_200);
      return total;
    },
  };
}

const noop: Limiter = { limit: async () => ({ ok: true, reset: 0 }), rows: async () => 0 };

/** Upstash client when configured (shared with the trading nonce store). */
export function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const g = globalThis as { __meLimiter?: Limiter };
function limiter(): Limiter {
  if (g.__meLimiter) return g.__meLimiter;
  const r = redis();
  if (!r) console.warn("[abuse] UPSTASH_REDIS_REST_URL/TOKEN not set: rate limits are OFF (fine for dev; set them in production)");
  return (g.__meLimiter = r ? upstashLimiter(r) : noop);
}
/** Tests swap in memoryLimiter(); undefined = back to the env choice. */
export const setLimiter = (l: Limiter | undefined) => void (g.__meLimiter = l);

/** Client IP from the platform only (RT-07): on Vercel `x-real-ip` / `x-vercel-forwarded-for`, which the edge sets.
 *  A client-sent `X-Forwarded-For` is never read. Off Vercel there is no trusted proxy: every anonymous caller
 *  shares one key ("local"), so limits stay global rather than per-request. */
export function clientIp(req: Request): string {
  if (!process.env.VERCEL) return "local";
  return req.headers.get("x-real-ip")?.trim() || req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Rate-limit key: the signed-in user, else the client IP (+ JA4 TLS fingerprint on Vercel). */
export function clientKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const ja4 = process.env.VERCEL ? req.headers.get("x-vercel-ja4-digest") : null;
  return `ip:${clientIp(req)}${ja4 ? `:${ja4}` : ""}`;
}

export const tooMany = (reset: number) => {
  const secs = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return Response.json({ error: "Too many requests. Slow down and try again shortly." }, { status: 429, headers: { "Retry-After": String(secs) } });
};

/** 429 Response when `key` is over `rule`, else null. */
export async function rateLimit(rule: Rule, key: string): Promise<Response | null> {
  try {
    const r = await limiter().limit(rule, key);
    return r.ok ? null : tooMany(r.reset);
  } catch (e) {
    console.error("[abuse] rate limiter unavailable", e instanceof Error ? e.message : e);
    return null;   // Upstash outage: serve (BotID and the paywall still apply) rather than take the site down
  }
}

/** Vercel BotID (docs/15). Pass-through off Vercel (local, CI, e2e). 403 for a detected bot, else null.
 *  The browser side is initBotId() in instrumentation-client.ts; its protect list must name the same routes. */
export async function botCheck(): Promise<Response | null> {
  if (!process.env.VERCEL) return null;
  try {
    const v = await checkBotId();
    return v.isBot && !v.isVerifiedBot ? Response.json({ error: "Automated access is not allowed." }, { status: 403 }) : null;
  } catch (e) {
    console.error("[abuse] BotID check failed", e instanceof Error ? e.message : e);
    return null;   // BotID outage: rate limits still apply
  }
}

/** BotID, then the rate limit: the first answer that refuses wins. */
export async function guard(req: Request, rule: Rule, userId?: string | null): Promise<Response | null> {
  return (await botCheck()) ?? (await rateLimit(rule, clientKey(req, userId)));
}

/** Anomaly log (docs/15): one line when an account (or IP) passes 5,000 rows served in an hour. */
export async function noteRows(req: Request, userId: string | null | undefined, n: number): Promise<void> {
  if (n <= 0) return;
  const key = clientKey(req, userId);
  try {
    const total = await limiter().rows(key, n);
    if (total > ROWS_PER_HOUR_ALERT && total - n <= ROWS_PER_HOUR_ALERT) {
      console.warn(`[anomaly] ${key} pulled ${total} rows this hour (> ${ROWS_PER_HOUR_ALERT})`);
    }
  } catch (e) {
    console.error("[abuse] row count failed", e instanceof Error ? e.message : e);
  }
}
