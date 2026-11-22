"use client";
// F13: share one bet. A button (mounted in the bet drawer) opens a sheet with the bet's share image
// (/api/og/bet/<id>), Share / Copy link / Save image, and your invite link with the live "n of 5" counter.
// The image and link are the same for everyone: nothing here depends on the user.
import { useEffect, useId, useRef, useState } from "react";
import { InvitePanel } from "./InvitePanel";

export function ShareSheet({ marketId, side, className }: { marketId: string; side: number; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const img = `/api/og/bet/${encodeURIComponent(marketId)}?side=${side}`;
  const link = () => `${location.origin}/m/${encodeURIComponent(marketId)}`;

  return (
    <>
      <button type="button" onClick={() => { setImgOk(true); setOpen(true); }} data-testid="share-bet" aria-haspopup="dialog" aria-label="Share this bet"
        className={className ?? "inline-flex min-h-11 min-w-11 items-center justify-center rounded-input border border-border bg-muted-bg text-soft hover:border-accent-border hover:text-text"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-labelledby={`${id}-t`}
        className="m-auto max-h-[92svh] w-[min(94vw,560px)] overflow-y-auto rounded-card border border-border bg-surface p-0 text-text backdrop:bg-black/60">
        {open && (
          <div className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id={`${id}-t`} className="text-lg font-semibold">Share this bet</h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-input px-3 text-sm text-muted hover:text-text">Close</button>
            </div>
            <div className="aspect-[1200/630] w-full overflow-hidden rounded-input border border-border bg-muted-bg">
              {imgOk
                ? <img src={img} alt="Share card for this bet" width={1200} height={630} onError={() => setImgOk(false)} className="size-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <p className="flex size-full items-center justify-center p-4 text-center text-sm text-muted">The image isn&apos;t available right now. You can still copy the link.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canShare && (
                <button type="button" onClick={() => navigator.share({ title: "A bet on Kismet", url: link() }).catch(() => {})}
                  className="min-h-11 rounded-input bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">Share</button>
              )}
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(link()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ } }}
                className="min-h-11 rounded-input border border-border bg-muted-bg px-4 text-sm font-medium hover:border-accent-border">{copied ? "Link copied" : "Copy link"}</button>
              <a href={img} download={`kismet-bet-${marketId}.png`} className="inline-flex min-h-11 items-center rounded-input border border-border bg-muted-bg px-4 text-sm font-medium hover:border-accent-border">Save image</a>
            </div>
            <section aria-labelledby={`${id}-i`} className="flex flex-col gap-3 border-t border-border pt-5">
              <h3 id={`${id}-i`} className="text-sm font-semibold text-soft">Invite friends, earn a free month</h3>
              <InvitePanel compact />
            </section>
            <p className="text-xs text-muted">Market analytics, not financial advice. Based on past results. 18+.</p>
          </div>
        )}
      </dialog>
    </>
  );
}
