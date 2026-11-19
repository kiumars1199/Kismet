// /login and /signup (docs/19 P2): one flow (email link, optional Google, 18+ and Terms box), copy per intent.
// The magic link signs in an existing account or creates a free one, so both pages post to the same endpoints.
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { accountsOffNote, authEnabled, getUser, safeNext } from "@/lib/auth/server";

const ERRORS: Record<string, string> = {
  terms: "Tick the box to confirm you're 18 or older and agree to the Terms.",
  link: "That sign-in link didn't work. It may have expired or been opened in a different browser. Send a new one.",
  google: "Google sign-in didn't start. Try again, or use your email.",
  rate: "Too many sign-in tries. Wait a minute and try again.",
  unavailable: "Sign-in isn't available right now. Try again in a minute.",
  closed: "New sign-ups are paused right now. Existing accounts can still log in.",
};

const COPY = {
  login: {
    title: "Log in",
    lede: "Welcome back. We'll email you a link, no password needed.",
    other: { q: "New to Kismet?", label: "Create a free account", href: "/signup" },
  },
  signup: {
    title: "Create your free account",
    lede: "See today's best bets, save views and keep My list on every device. No password, no card: we email you a link.",
    other: { q: "Already have an account?", label: "Log in", href: "/login" },
  },
} as const;

export async function AuthPage({ mode, searchParams }: {
  mode: keyof typeof COPY;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);
  const c = COPY[mode];
  const other = next === "/" ? c.other.href : `${c.other.href}?next=${encodeURIComponent(next)}`;

  return (
    <section className="mx-auto flex w-full max-w-[420px] flex-col gap-7 py-6 md:py-14">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-balance text-[32px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[40px]">{c.title}</h1>
        <p className="text-[15px] leading-relaxed text-muted">{c.lede}</p>
      </header>
      {authEnabled() ? (
        <>
          <LoginForm next={next} error={sp.error ? ERRORS[sp.error] ?? ERRORS.unavailable : undefined} />
          <p className="text-sm text-muted">
            {c.other.q}{" "}
            <Link href={other} className="font-medium text-accent-hover underline-offset-4 hover:underline">{c.other.label}</Link>
          </p>
        </>
      ) : (
        <p className="rounded-card border border-border bg-surface p-5 text-sm leading-relaxed text-soft">
          {accountsOffNote()}{" "}
          <Link href="/" className="text-accent-hover underline-offset-4 hover:underline">Go to Best bets</Link>
        </p>
      )}
    </section>
  );
}
