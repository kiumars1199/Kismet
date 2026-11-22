import "server-only";
// F13: first sign-in hook. If this browser came through /invite/<code> (cookie), record the new account against the
// code's owner. Best effort: a failure here never blocks sign-in. The address is hashed with INVITE_IP_SALT (a server
// secret; unset = address checks are skipped) and never stored.
import { cookies, headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { clientIp } from "@/lib/abuse";
import { adminEnabled, supabaseAdmin } from "@/lib/auth/server";
import { ipHash, isInviteCode } from "./core";
import { recordSignup } from "./server";

export const INVITE_COOKIE = "me_invite";

export async function hashedIp(): Promise<string | null> {
  return ipHash(clientIp(new Request("http://invite.local", { headers: await headers() })), process.env.INVITE_IP_SALT);
}

export async function recordInviteFromCookie(user: User): Promise<void> {
  try {
    const jar = await cookies();
    const code = jar.get(INVITE_COOKIE)?.value ?? "";
    if (!isInviteCode(code) || !adminEnabled()) return;
    await recordSignup(supabaseAdmin(), { user, code, ipHash: await hashedIp() });
    jar.delete(INVITE_COOKIE);
  } catch (e) {
    console.error("[invites] could not record sign-up:", e instanceof Error ? e.message : e);
  }
}
