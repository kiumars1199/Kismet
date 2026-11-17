// Sign in / sign up (docs/14 §1, T-41): Google or email link, no passwords. 18+ and Terms box required.
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { authEnabled, getUser, safeNext } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  terms: "Tick the box to confirm you're 18 or older and agree to the Terms.",
  link: "That sign-in link didn't work. It may have expired or been opened in a different browser. Send a new one.",
  google: "Google sign-in didn't start. Try again, or use your email.",
  rate: "Too many sign-in tries. Wait a minute and try again.",
  unavailable: "Sign-in isn't available right now. Try again in a minute.",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);

  return (
    <section className="mx-auto flex w-full max-w-[420px] flex-col gap-7 py-6 md:py-14">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[32px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[40px]">Sign in</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          New here? The same steps create your free account. Your saved views, My list and My bets follow you to every device.
        </p>
      </header>
      {authEnabled() ? (
        <LoginForm next={next} error={sp.error ? ERRORS[sp.error] ?? ERRORS.unavailable : undefined} />
      ) : (
        <p className="rounded-card border border-border bg-surface p-5 text-sm leading-relaxed text-soft">
          Accounts aren&apos;t switched on here. Everything is unlocked and saved in this browser.{" "}
          <Link href="/" className="text-accent-hover underline-offset-4 hover:underline">Go to Best bets</Link>
        </p>
      )}
    </section>
  );
}
