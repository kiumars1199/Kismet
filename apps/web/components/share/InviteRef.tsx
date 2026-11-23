"use client";
// F13: a shared bet link /m/<id>?ref=<code> remembers the sharer's invite code (server cookie, same as /invite/<code>),
// so a friend who signs up from it counts toward the sharer's reward. Renders nothing.
import { useEffect } from "react";

export function InviteRef() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(location.search).get("ref");
      if (code && /^[a-z0-9]{8}$/.test(code)) void fetch("/api/invite/ref", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }), credentials: "same-origin" }).catch(() => {});
    } catch { /* no code to remember */ }
  }, []);
  return null;
}
