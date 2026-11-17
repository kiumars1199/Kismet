// Server-only auth helpers (docs/08, docs/15 § Auth). There is no browser Supabase client: sign-in, the
// callback and every data read go through the server, so the session cookies can be HttpOnly.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEMO_MODE } from "@/lib/config";
import type { Tier } from "@/lib/entitlements";

const env = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  service: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
});

/** Accounts are on when not in demo mode and the Supabase project is configured. */
export const authEnabled = () => !DEMO_MODE && !!env().url && !!env().anon;
/** What /login and /account say while accounts are off. "Everything is unlocked" is true only in demo mode;
 *  a production build without Supabase keys serves the Free plan (lib/entitlements.ts). */
export const accountsOffNote = (demo = DEMO_MODE) =>
  demo
    ? "Accounts aren't switched on here. Everything is unlocked and saved in this browser."
    : "Sign-in isn't available yet. You can browse on the Free plan: every open market, 15 minutes behind, top 25 rows, with returns shown as ranges.";
/** The service-role client can be built (cron jobs). */
export const adminEnabled = () => !!env().url && !!env().service;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Per-request client acting as the signed-in user (RLS applies). */
export async function supabaseServer(): Promise<SupabaseClient> {
  const jar = await cookies();
  const { url, anon } = env();
  return createServerClient(url, anon, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, { ...options, ...COOKIE_OPTIONS });
        } catch { /* server component render: middleware refreshes cookies instead */ }
      },
    },
  });
}

/** Service-role client. Server only; bypasses RLS: use for webhook writes and account deletion. */
export function supabaseAdmin(): SupabaseClient {
  const { url, service } = env();
  if (!url || !service) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface SessionUser { id: string; email: string }

/** The verified user (getUser() checks the JWT with Supabase), or null. */
export async function getUser(): Promise<SessionUser | null> {
  if (!authEnabled()) return null;
  try {
    const { data } = await (await supabaseServer()).auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
  } catch {
    return null;
  }
}

export interface Me {
  user: SessionUser | null;
  tier: Tier;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/** Tier comes only from the webhook-written subscriptions row (docs/15 § Billing). Demo mode = premium. */
export async function getMe(): Promise<Me> {
  const none = { status: null, current_period_end: null, cancel_at_period_end: false };
  if (DEMO_MODE) return { user: null, tier: "premium", ...none };
  const user = await getUser();
  if (!user) return { user: null, tier: "free", ...none };
  const { data } = await (await supabaseServer())
    .from("subscriptions").select("tier, status, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id).maybeSingle();
  const tier: Tier = data?.tier === "pro" || data?.tier === "premium" ? data.tier : "free";
  return {
    user, tier,
    status: data?.status ?? null,
    current_period_end: data?.current_period_end ?? null,
    cancel_at_period_end: !!data?.cancel_at_period_end,
  };
}

export const getTier = async (): Promise<Tier> => (await getMe()).tier;

/** `next=` must be a same-origin relative path (docs/15 § open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !/^\/(?![/\\])/.test(next) || /[\r\n\t]/.test(next)) return fallback;
  return next;
}

/** CSRF: mutations must come from our own origin (docs/15 § Web hardening). The one check every mutating route uses. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return host === new URL(req.url).host || host === req.headers.get("host") || origin === process.env.NEXT_PUBLIC_SITE_URL;
  } catch {
    return false;
  }
}
