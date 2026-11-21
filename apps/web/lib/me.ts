"use client";
// Client copy of /api/me (session + plan). Display only: every gate is enforced again on the server.
import { useSyncExternalStore } from "react";
import type { Tier } from "@/lib/entitlements";
import type { Gated } from "@/lib/beta-list";

export interface MeResponse {
  user: { id: string; email: string } | null;
  tier: Tier;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  demo: boolean;
  auth: boolean;       // accounts configured
  billing: boolean;    // Stripe configured
  admin?: boolean;     // server-decided; shows the Admin link only
  beta?: boolean;      // admin or live comp grant: sees beta features (lib/beta.ts); routes check again
  nav?: Gated[];       // #17/#73: gated nav links (Combos, Kalshi) to show, decided on the server (lib/beta.ts navFeatures)
}

/** #17/#73: what the root layout already knows about a signed-in visitor, so the header renders signed in from the
 *  first HTML on every page instead of filling in when /api/me answers. */
export interface HeaderHint { signedIn: boolean; admin: boolean; nav: Gated[] }

/** The header's view: /api/me once it answers, else the layout's hint (null: unknown yet). */
export const headerView = (me: MeResponse | null, hint: HeaderHint | null | undefined): HeaderHint | null =>
  me ? { signedIn: !!me.user, admin: !!me.admin, nav: me.nav ?? [] } : hint ?? null;

let me: MeResponse | null = null;
let inflight: Promise<MeResponse | null> | null = null;
const listeners = new Set<() => void>();

export function loadMe(force = false): Promise<MeResponse | null> {
  if (!force && (me || inflight)) return inflight ?? Promise.resolve(me);
  inflight = fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : null))
    .catch(() => null)
    .then((v) => {
      if (v) { me = v; listeners.forEach((f) => f()); }
      inflight = null;
      return v;
    });
  return inflight;
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** null until /api/me has answered. */
export function useMe(): MeResponse | null {
  return useSyncExternalStore(subscribe, () => me, () => null);
}

export const currentMe = () => me;
