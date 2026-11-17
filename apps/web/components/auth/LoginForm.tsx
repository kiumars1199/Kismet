"use client";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { btn, btnPrimary, input } from "@/components/kit";

export function LoginForm({ next, error: initialError }: { next: string; error?: string }) {
  const [accept, setAccept] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(initialError ?? "");
  const [termsError, setTermsError] = useState(false);
  const ids = { terms: useId(), email: useId(), err: useId() };

  const needTerms = (e: FormEvent) => {
    if (accept) return false;
    e.preventDefault();
    setTermsError(true);
    document.getElementById(ids.terms)?.focus();
    return true;
  };

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    if (needTerms(e)) return;
    setState("sending");
    setError("");
    const res = await fetch("/api/auth/magic-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), accept: true, next }),
    }).catch(() => null);
    if (res?.ok) return setState("sent");
    setState("idle");
    setError((await res?.json().catch(() => null))?.error ?? "Couldn't send the link. Check your connection and try again.");
  }

  if (state === "sent") {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-card border border-accent-border bg-accent-bg p-5">
        <h2 className="text-lg font-semibold text-accent-soft">Check your email</h2>
        <p className="text-sm leading-relaxed text-accent-softer">
          We sent a sign-in link to <span className="font-medium text-accent-soft">{email}</span>. Open it in this browser.
          It works once and expires in 15 minutes.
        </p>
        <button type="button" className="w-fit text-sm text-accent-hover underline-offset-4 hover:underline" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p id={ids.err} role="alert" className="rounded-input border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text">{error}</p>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.terms} className="flex cursor-pointer items-start gap-3 rounded-input border border-border bg-surface p-4 text-sm leading-relaxed text-soft has-[:focus-visible]:border-accent-border">
          <input
            id={ids.terms} type="checkbox" checked={accept} required aria-invalid={termsError && !accept}
            onChange={(e) => { setAccept(e.target.checked); setTermsError(false); }}
            className="mt-0.5 size-5 flex-none accent-[var(--accent)]"
          />
          <span>
            I&apos;m 18 or older and agree to the{" "}
            <Link href="/terms" className="text-accent-hover underline underline-offset-4" target="_blank">Terms</Link> and{" "}
            <Link href="/privacy" className="text-accent-hover underline underline-offset-4" target="_blank">Privacy Policy</Link>.
          </span>
        </label>
        {termsError && !accept && <p className="text-xs text-warning">Tick this box to continue.</p>}
      </div>

      <form method="post" action="/api/auth/google" onSubmit={needTerms}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="accept" value={accept ? "on" : ""} />
        <button type="submit" className={`${btn} w-full min-h-12 text-[15px]`}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
      </div>

      <form method="post" onSubmit={sendLink} className="flex flex-col gap-3">{/* post: never put the email in the URL */}
        <label htmlFor={ids.email} className="text-xs font-medium text-muted">Email</label>
        <input
          id={ids.email} type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} className={input}
        />
        <button type="submit" className={`${btnPrimary} min-h-12 text-[15px]`} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}
