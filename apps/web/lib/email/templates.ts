// Email templates. Each returns subject + html + text and always includes the unsubscribe link and
// the disclaimer. Wording follows docs/06: plain facts, never "bet this".
import { message, title } from "@/lib/alerts";
import type { Market, Side } from "@/lib/types";
import { siteUrl, type Email } from "./index";

export const DISCLAIMER = "Market analytics, not financial advice. Based on past results. 18+.";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, lines: string[], cta: { href: string; label: string }, unsub: string, why: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#0b0f0d;color:#e6ece9;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 4px;color:#10b981;font-weight:600">MarketEdge</p>
<h1 style="margin:0 0 16px;font-size:18px">${esc(heading)}</h1>
${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join("\n")}
<p style="margin:20px 0"><a href="${esc(cta.href)}" style="background:#10b981;color:#000;padding:10px 16px;border-radius:12px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>
<hr style="border:0;border-top:1px solid #1a2520;margin:24px 0">
<p style="margin:0 0 8px;font-size:12px;color:#8a9a93">${esc(why)} <a href="${esc(unsub)}" style="color:#8a9a93">Unsubscribe</a></p>
<p style="margin:0;font-size:12px;color:#8a9a93">${esc(DISCLAIMER)}</p>
</div></body></html>`;
  const text = [heading, "", ...lines, "", `${cta.label}: ${cta.href}`, "", `${why} Unsubscribe: ${unsub}`, DISCLAIMER].join("\n");
  return { html, text };
}

export interface AlertEmailInput {
  to: string;
  ruleName: string;
  market: Market;
  side: Side;
  timeZone: string;
  live?: { ask: number; roi: number } | null;
  unsubscribeUrl: string;
}

export function alertEmail(i: AlertEmailInput): Email {
  const heading = title(i.market);
  const { html, text } = layout(
    heading,
    [message(i.market, i.side, i.timeZone, i.live)],
    { href: `${siteUrl()}/m/${encodeURIComponent(i.market.id)}?side=${i.side.side_index}`, label: "Open in MarketEdge" },
    i.unsubscribeUrl,
    `You get this because you set the alert "${i.ruleName}".`,
  );
  return { to: i.to, subject: `Alert: ${heading}`.slice(0, 140), html, text, unsubscribeUrl: i.unsubscribeUrl };
}

/** One-time sign-in link sent from the admin panel (support: "my link never came"). Expires like any magic link. */
export function signInEmail(to: string, link: string, unsubscribeUrl: string): Email {
  const { html, text } = layout(
    "Your MarketEdge sign-in link",
    ["Use the button below to sign in. The link works once and expires soon.", "If you didn't ask for this, ignore this email."],
    { href: link, label: "Sign in to MarketEdge" },
    unsubscribeUrl,
    "You get this because our support team sent you a sign-in link.",
  );
  return { to, subject: "Your MarketEdge sign-in link", html, text, unsubscribeUrl };
}

/** Stripe invoice.payment_failed (lib/billing/stripe.ts). Account mail, but still carries unsubscribe and the disclaimer. */
export function paymentFailedEmail(to: string, unsubscribeUrl: string): Email {
  const { html, text } = layout(
    "Your MarketEdge payment didn't go through",
    ["We couldn't charge your card. Update it from your account page (Manage billing) to keep your plan."],
    { href: `${siteUrl()}/account`, label: "Open your account" },
    unsubscribeUrl,
    "You get this because you have a MarketEdge subscription.",
  );
  return { to, subject: "Your MarketEdge payment didn't go through", html, text, unsubscribeUrl };
}
