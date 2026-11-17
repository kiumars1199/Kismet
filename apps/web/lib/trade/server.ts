// Server side of paper trading and the extension sign-in (docs/16 §3–4, docs/15 § Trading keys, docs/09 § Auth).
// We never see Kalshi keys. We only issue (1) short-lived extension sign-in tokens and (2) one-time order nonces
// bound to the exact order the user confirmed, which the extension checks with us before it signs anything.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { DEMO_MODE } from "@/lib/config";
import type { Tier } from "@/lib/entitlements";

/** Only "demo" turns trading on. Anything else (unset, "prod") = off: real money waits for docs/16 §5 sign-offs. */
export const tradingEnv = (): "demo" | null => (process.env.KALSHI_TRADING_ENV === "demo" ? "demo" : null);

/** Allow-listed: anyone in demo mode, else emails in TRADING_ALLOWLIST (comma-separated). */
export function tradingAllowed(email: string | null): boolean {
  if (DEMO_MODE) return true;
  if (!email) return false;
  const list = (process.env.TRADING_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Signed-in user's email. ponytail: no auth yet (Lane L builds Supabase Auth); returns null so outside demo
 * mode nobody is allow-listed until the session lookup lands here.
 */
export async function currentUser(_req: Request): Promise<{ email: string; tier: Tier } | null> {
  if (DEMO_MODE) return { email: "demo@localhost", tier: "premium" };
  return null;
}

/** The extension's ID (Chrome Web Store ID in production; the pinned dev ID otherwise). */
export const extensionId = () => process.env.NEXT_PUBLIC_EXTENSION_ID || "cgoaaiaghbckpalppklocajbdpoelmbd";

let devSecret: Buffer | null = null;
function secret(): Buffer | null {
  const s = process.env.EXT_SIGNING_SECRET;
  if (s && s.length >= 32) return Buffer.from(s);
  if (DEMO_MODE) return (devSecret ??= randomBytes(32)); // per process: fine for one dev server
  return null;
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (key: Buffer, body: string) => createHmac("sha256", key).update(body).digest();

function seal(payload: object): string | null {
  const key = secret();
  if (!key) return null;
  const body = b64u(JSON.stringify(payload));
  return `${body}.${b64u(mac(key, body))}`;
}

function open<T>(token: string): T | null {
  const key = secret();
  const [body, sig] = token.split(".");
  if (!key || !body || !sig) return null;
  const want = mac(key, body);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()) as T; } catch { return null; }
}

/** Key-sorted JSON: the same order hashes the same no matter who serialized it. */
export const canonical = (x: unknown): string =>
  Array.isArray(x) ? `[${x.map(canonical).join(",")}]`
  : x && typeof x === "object" ? `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${canonical((x as Record<string, unknown>)[k])}`).join(",")}}`
  : JSON.stringify(x);

const digest = (action: string, payload: unknown) => createHash("sha256").update(`${action}\n${canonical(payload)}`).digest("base64url");

export const NONCE_TTL_MS = 2 * 60_000;
type Nonce = { k: "nonce"; a: string; h: string; exp: number; n: string };

/** One-time nonce for exactly this action + payload, valid 2 minutes. Null when no signing secret is set. */
export const issueNonce = (action: "place" | "cancel", payload: unknown, now = Date.now()) =>
  seal({ k: "nonce", a: action, h: digest(action, payload), exp: now + NONCE_TTL_MS, n: randomBytes(12).toString("base64url") } satisfies Nonce);

// ponytail: consumed set is per server instance; a replay on another instance still can't double-place because
// Kalshi dedupes client_order_id (part of the hashed payload). Move to Upstash SET NX if that guarantee is not enough.
const used = new Map<string, number>();

/** True once per nonce, and only for the same action + payload it was issued for. */
export function consumeNonce(nonce: string, action: string, payload: unknown, now = Date.now()): boolean {
  const n = open<Nonce>(nonce);
  if (!n || n.k !== "nonce" || n.a !== action || n.exp < now || n.h !== digest(action, payload) || used.has(n.n)) return false;
  for (const [id, exp] of used) if (exp < now) used.delete(id);
  used.set(n.n, n.exp);
  return true;
}

export const EXT_TOKEN_TTL_MS = 30 * 60_000;
type ExtToken = { k: "ext"; sub: string; tier: Tier; exp: number };

/** Short-lived extension sign-in (docs/09 § Auth). The extension refreshes it before it expires. */
export function issueExtToken(sub: string, tier: Tier, now = Date.now()) {
  const exp = now + EXT_TOKEN_TTL_MS;
  const token = seal({ k: "ext", sub, tier, exp } satisfies ExtToken);
  return token ? { token, exp, tier } : null;
}

export function verifyExtToken(token: string | null | undefined, now = Date.now()): ExtToken | null {
  const t = token ? open<ExtToken>(token) : null;
  return t && t.k === "ext" && t.exp > now ? t : null;
}

/** Same-origin check for browser POSTs that mint nonces/tokens (CSRF): Origin must match the host we serve. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host"); } catch { return false; }
}
