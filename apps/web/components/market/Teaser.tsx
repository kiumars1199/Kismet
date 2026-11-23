// Signed-out view of /m/[id] and /event/[id] (T-276): title, category and closing time, then a sign-up prompt that
// returns here. Rendered on the server from lib/teaser.ts only, so the HTML carries no verdict or number from the model.
import Link from "next/link";
import { zonedTime } from "@/lib/zone";
import { TEASER_LINE, type Teaser } from "@/lib/teaser";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { closesLine, formatCount, pct } from "@/lib/format";
import { FREE_BEST_BETS_A_DAY } from "@/lib/entitlements";

const WHEN = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" } as const;

const norm = (x: string) => x.toLowerCase().replace(/[.…]+$/g, "").replace(/[^a-z0-9]+/g, " ").trim();
/** The event line is often the title cut short ("Will Trump publicly insult someone on...?"): hide it then. */
export function eventDuplicatesTitle(title: string, event: string): boolean {
  const a = norm(title), b = norm(event);
  return !b || a.startsWith(b) || b.startsWith(a);
}

/** `zone`: the visitor's (lib/zone-server.ts requestZone), null = unknown: Eastern time, labeled. */
export function TeaserView({ t, path, zone = null }: { t: Teaser; path: string; zone?: string | null }) {
  const closes = t.closes_at ? new Date(t.closes_at * 1000) : null;
  const next = encodeURIComponent(path);
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-6 py-4 md:py-10" data-testid="teaser">
      <header className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: t.title }]} />
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {t.category}{t.kind === "event" && t.markets ? ` · ${formatCount(t.markets)} ${t.markets === 1 ? "market" : "markets"}` : ""}
        </p>
        <h1 className="text-balance text-[28px] font-bold leading-tight tracking-[-0.02em] md:text-[36px]">{t.title}</h1>
        {t.event && !eventDuplicatesTitle(t.title, t.event) ? <p className="text-sm text-soft">{t.event}</p> : null}
        {closes ? (
          <p className="text-sm text-muted">
            <span data-testid="teaser-closes-in" className="font-medium text-soft">{closesLine(t.closes_at, Date.now(), true)}</span>
            {" · "}<time dateTime={closes.toISOString()}>{zonedTime(t.closes_at!, zone, WHEN)}</time>
          </p>
        ) : null}
        {t.kind === "market" && typeof t.price === "number" ? (
          <p className="text-sm text-muted" data-testid="teaser-price">
            {t.price_outcome ? `${t.price_outcome}: ` : "Market price: "}<span className="font-semibold text-text">{pct(t.price)}</span>
            <span> priced by the market</span>
          </p>
        ) : null}
      </header>
      <section className="flex flex-col gap-4 rounded-card border border-accent-border bg-accent-bg p-6">
        <p className="text-[17px] font-medium text-accent-soft">{TEASER_LINE}</p>
        <p className="text-sm leading-relaxed text-accent-softer">
          We compare the price with how often bets like this one have won, after the fee and the spread. Free accounts get{" "}
          {FREE_BEST_BETS_A_DAY} best bets a day, no card needed.
        </p>
        {t.kind === "market" ? (
          <p data-testid="teaser-verdict" className="rounded-input border border-accent-border px-4 py-3 text-sm text-accent-softer">
            <span aria-hidden>🔒</span> <span className="font-semibold text-accent-soft">Kismet&apos;s verdict</span>: sign up to unlock it.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href={`/signup?next=${next}`} className="inline-flex min-h-12 items-center justify-center rounded-input bg-accent px-6 font-semibold text-on-accent hover:bg-accent-hover">
            Sign up free
          </Link>
          <Link href={`/login?next=${next}`} className="min-h-11 content-center text-sm font-medium text-accent-hover underline-offset-4 hover:underline">
            Log in
          </Link>
        </div>
      </section>
    </article>
  );
}
