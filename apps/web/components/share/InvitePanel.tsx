"use client";
// F13: your invite link, its QR code and the live "n of 5" counter. Used on /account (full) and in the share sheet
// (compact). The counter refreshes on focus and every 30 s while the tab is visible. Space is reserved while loading.
import { useCallback, useEffect, useState } from "react";

export interface InviteInfo { code: string; url: string; verified: number; target: number; rewarded: boolean; comp_until: string | null }

export function useInvite(active = true) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState(false);
  const [off, setOff] = useState(false);   // signed out, or accounts are off (demo): there is no invite link
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invite", { credentials: "same-origin", cache: "no-store" });
      if ([401, 404, 503].includes(res.status)) { setOff(true); return; }
      if (!res.ok) throw new Error(String(res.status));
      setInfo((await res.json()) as InviteInfo);
      setError(false);
    } catch { setError(true); }
  }, []);
  useEffect(() => {
    if (!active) return;
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const t = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [active, load]);
  return { info, error, off, retry: load };
}

/** The QR code as one SVG path (drawn with React: no injected markup). Black on white with a 4-module quiet zone. */
function Qr({ url }: { url: string }) {
  const [d, setD] = useState<{ path: string; size: number } | null>(null);
  useEffect(() => {
    let live = true;
    import("qrcode").then((m) => {
      const { modules } = m.create(url, { errorCorrectionLevel: "M" });
      const n = modules.size;
      let path = "";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules.get(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
      if (live) setD({ path, size: n + 8 });
    }).catch(() => {});
    return () => { live = false; };
  }, [url]);
  return (
    <div role="img" aria-label="QR code that opens your invite page" data-testid="invite-qr" className="size-40 flex-none overflow-hidden rounded-input bg-white">
      {d && <svg viewBox={`0 0 ${d.size} ${d.size}`} className="size-full" shapeRendering="crispEdges" aria-hidden="true"><path d={d.path} fill="#000" /></svg>}
    </div>
  );
}

export function Counter({ info }: { info: InviteInfo }) {
  const n = Math.min(info.verified, info.target);
  return (
    <div data-testid="invite-counter" className="flex flex-col gap-2">
      <p className="text-sm text-soft"><span className="font-semibold text-text tabular-nums">{n} of {info.target}</span> friends have joined from your link</p>
      <div className="h-1.5 w-full rounded-full bg-muted-bg" role="progressbar" aria-valuemin={0} aria-valuemax={info.target} aria-valuenow={n} aria-label="Friends joined">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(n / info.target) * 100}%` }} />
      </div>
      {info.rewarded && <p className="text-sm text-accent-soft" data-testid="invite-rewarded">Your free month of Premium is on your account{info.comp_until ? ` until ${new Date(info.comp_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}.</p>}
    </div>
  );
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function InvitePanel({ compact = false }: { compact?: boolean }) {
  const { info, error, off, retry } = useInvite();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  if (off) return compact ? null : <p className="text-sm text-muted">Sign in to get your invite link.</p>;
  if (error && !info) {
    return (
      <div className="flex min-h-24 flex-col items-start gap-2" role="alert">
        <p className="text-sm text-soft">We couldn&apos;t load your invite link.</p>
        <button type="button" onClick={() => void retry()} className="min-h-11 rounded-input border border-border bg-muted-bg px-4 text-sm font-medium hover:border-accent-border">Try again</button>
      </div>
    );
  }
  if (!info) return <div aria-busy="true" className={compact ? "h-28" : "h-[29rem] sm:h-44"}   /* ~ the loaded height, so the sections below don't jump (CLS) */ />;

  return (
    <div className={`flex ${compact ? "flex-col" : "flex-col sm:flex-row"} gap-5`} data-testid="invite-panel">
      {!compact && <Qr url={info.url} />}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Counter info={info} />
        <p className="text-sm text-muted">When 5 friends sign up from your link and confirm their email, you get a month of Premium free. Sign-ups from your own devices don&apos;t count.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={info.url} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 min-w-0 flex-1 rounded-input border border-border bg-input px-3 text-sm text-soft" />
          <button type="button" onClick={async () => { setCopied(await copy(info.url)); setTimeout(() => setCopied(false), 2000); }}
            className="min-h-11 rounded-input border border-border bg-muted-bg px-4 text-sm font-medium hover:border-accent-border">{copied ? "Copied" : "Copy link"}</button>
          {canShare && (
            <button type="button" onClick={() => navigator.share({ title: "Kismet", text: "Good-value bets, in plain words.", url: info.url }).catch(() => {})}
              className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">Share</button>
          )}
        </div>
      </div>
    </div>
  );
}
