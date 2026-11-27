"use client";
// F10: "Phone alerts" card on /alerts. One tap: ask the browser for permission, register /sw.js, subscribe to web push
// and save the subscription (POST /api/push/subscribe). The server key comes from GET /api/push/subscribe, so Q only
// sets VAPID_* on the server. iOS only allows web push for a site added to the Home Screen (iOS 16.4+): say so.
import { useCallback, useEffect, useState } from "react";
import { btn, btnPrimary, card } from "@/components/kit";

type State = "checking" | "unsupported" | "ios-install" | "off-server" | "blocked" | "off" | "on" | "busy" | "error";

export const IOS_HINT = "On iPhone, first add Kismet to your Home Screen: tap Share, then Add to Home Screen, then open Kismet from there. Needs iOS 16.4 or later.";

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const canPush = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const DEFAULT_COPY = "Get your alerts on this device even when Kismet is closed. Our servers check once a day.";
const TURN_ON = "Turn on phone alerts";

export function PushToggle() {
  const [state, setState] = useState<State>("checking");

  const refresh = useCallback(async () => {
    if (!canPush()) return setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const turnOn = async () => {
    setState("busy");
    try {
      const k = await fetch("/api/push/subscribe", { cache: "no-store" });
      const publicKey = k.ok ? ((await k.json()) as { publicKey: string | null }).publicKey : null;
      if (!publicKey) return setState("off-server");
      if ((await Notification.requestPermission()) !== "granted") return setState(Notification.permission === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) { await sub.unsubscribe().catch(() => false); return setState("error"); }
      setState("on");
    } catch {
      setState("error");
    }
  };

  const turnOff = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("error");
    }
  };

  const note: Partial<Record<State, string>> = {
    unsupported: "This browser can't show alerts when Kismet is closed. Alerts still land in the bell here.",
    "ios-install": IOS_HINT,
    "off-server": "Phone alerts aren't switched on yet. Alerts still land in the bell.",
    blocked: "Notifications are blocked for Kismet. Allow them in your browser or phone settings, then come back.",
    error: "Couldn't turn alerts on for this device. Try again in a moment.",
  };

  return (
    <section data-testid="push-toggle" aria-labelledby="push-title" className={`${card} flex min-h-[5.5rem] flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="max-w-xl">
        <h2 id="push-title" className="text-sm font-semibold">Phone alerts</h2>
        {/* While checking, the "off" text and button (the usual result) hold their space invisibly, so the card is already
            its final height and nothing below it moves (T-wt2g note: 88 -> 146 px at 390). No button until scripts run. */}
        <p className="grid text-sm text-muted" aria-live="polite">
          <span className="[grid-area:1/1]">
            {state === "checking" ? "Checking this device…"
              : state === "on" ? "On for this device. You'll get an alert here when a rule that uses browser notifications fires, even when Kismet is closed."
              : note[state] ?? DEFAULT_COPY}
          </span>
          {state === "checking" && <span aria-hidden="true" className="invisible [grid-area:1/1]">{DEFAULT_COPY}</span>}
        </p>
      </div>
      {state === "checking" && <span aria-hidden="true" className={`${btnPrimary} invisible`}>{TURN_ON}</span>}
      {(state === "off" || state === "error" || state === "busy" || state === "off-server") && (
        <button type="button" className={btnPrimary} disabled={state === "busy" || state === "off-server"} onClick={turnOn}>
          {state === "busy" ? "Working…" : TURN_ON}
        </button>
      )}
      {state === "on" && <button type="button" className={btn} onClick={turnOff}>Turn off</button>}
    </section>
  );
}
