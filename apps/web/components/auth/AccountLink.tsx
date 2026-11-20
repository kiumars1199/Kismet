"use client";
// Header: "Log in" + "Sign up" (primary) when signed out, "Account" when signed in (paid mode only; nothing in demo mode).
import Link from "next/link";
import { useMe } from "@/lib/me";

// signedOutHint (T-295): accounts on and no session cookie, so the buttons render with the page instead of popping in
// when /api/me answers (that moved the whole page down: CLS on every prerendered page).
export function AccountLink({ signedOutHint = false }: { signedOutHint?: boolean }) {
  const me = useMe();
  if (!me ? !signedOutHint : !me.auth) return null;
  return me?.user
    ? (
      <>
        {me.admin && <Link href="/admin" className="hidden min-h-11 sm:flex items-center rounded-input px-3 text-sm text-muted hover:text-text">Admin</Link>}
        <Link href="/account" className="flex min-h-11 items-center rounded-input px-3 text-sm text-muted hover:text-text">Account</Link>
      </>
    )
    : (
      <>
        <Link href="/login" className="flex min-h-11 flex-none items-center whitespace-nowrap rounded-input px-2 text-sm font-medium text-muted hover:text-text sm:px-2.5">Log in</Link>
        <Link href="/signup" className="flex min-h-11 flex-none items-center whitespace-nowrap rounded-input bg-accent px-3 text-sm sm:px-3.5 font-semibold text-on-accent hover:bg-accent-hover">Sign up</Link>
      </>
    );
}
