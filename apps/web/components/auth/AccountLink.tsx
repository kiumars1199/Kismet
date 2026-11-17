"use client";
// Header: "Sign in" or "Account" (paid mode only; nothing in demo mode).
import Link from "next/link";
import { useMe } from "@/lib/me";

export function AccountLink() {
  const me = useMe();
  if (!me?.auth) return null;
  return me.user
    ? (
      <>
        {me.admin && <Link href="/admin" className="hidden min-h-11 sm:flex items-center rounded-input px-3 text-sm text-muted hover:text-text">Admin</Link>}
        <Link href="/account" className="flex min-h-11 items-center rounded-input px-3 text-sm text-muted hover:text-text">Account</Link>
      </>
    )
    : <Link href="/login" className="flex min-h-11 flex-none items-center whitespace-nowrap rounded-input border border-border px-3.5 text-sm font-medium hover:border-accent-border">Sign in</Link>;
}
