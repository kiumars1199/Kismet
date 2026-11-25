"use client";
// T-wt3l: reports how tall the /bets page is, so the loading skeleton on the way back (loading.tsx) can reserve that height: the restored scroll
// position is then reachable at once and the footer never shoots down when the list arrives. /api/bets/height keeps it in a server-set cookie (the
// skeleton is rendered on the server, and the browser sets no cookies itself). Sent on pagehide, on any click (a soft navigation away: by the time
// this unmounts the next page is already in <main>) and, throttled, while scrolling; a shorter list later just overwrites it.
import { useEffect } from "react";

export function RememberHeight() {
  useEffect(() => {
    let last = 0;
    const send = () => {
      try {
        const h = Math.round(document.getElementById("main")?.getBoundingClientRect().height ?? 0);
        if (h <= 0 || h === last) return;
        last = h;
        const body = JSON.stringify({ h });
        if (!navigator.sendBeacon?.("/api/bets/height", new Blob([body], { type: "application/json" }))) void fetch("/api/bets/height", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
      } catch { /* blocked or offline: the skeleton keeps its default reserve */ }
    };
    let t: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { if (!t) t = setTimeout(() => { t = undefined; send(); }, 500); };
    const first = setTimeout(send, 1_500);
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("pagehide", send);
    window.addEventListener("click", send, true);
    return () => { clearTimeout(first); clearTimeout(t); window.removeEventListener("scroll", soon); window.removeEventListener("pagehide", send); window.removeEventListener("click", send, true); };
  }, []);
  return null;
}
