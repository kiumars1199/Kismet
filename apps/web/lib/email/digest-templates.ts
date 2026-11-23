// F12: the morning digest email. Same flags for everyone with the same topics; plain wording, multipliers and
// percentages only (CLAUDE.md rule 6), the disclaimer, and a one-click unsubscribe (RFC 8058) on the optional mail.
import { closesIn, pct } from "@/lib/format";
import { formatOdds } from "@/lib/odds";
import { siteUrl, type Email } from "./index";
import { layout } from "./templates";

export const MAX_DIGEST_BETS = 5;

export interface DigestBet { id: string; title: string; outcome: string; ask: number; win_prob: number; side_index: 0 | 1; closes_at: number }

const line = (b: DigestBet, now: number) =>
  `${b.title}: ${b.outcome} · pays ${formatOdds(b.ask, "decimal")} · won ${pct(b.win_prob)} before${b.closes_at ? ` · closes ${closesIn(b.closes_at, now)}` : ""}`;

export function digestEmail(i: { to: string; bets: DigestBet[]; unsubscribeUrl: string; now: number; timeZone?: string }): Email {
  const bets = i.bets.slice(0, MAX_DIGEST_BETS);
  const subject = `Today on Kismet: ${bets.length} ${bets.length === 1 ? "bet" : "bets"} priced below their win chance`;
  const base = layout(
    "Today's best bets in your topics",
    [...bets.map((b) => line(b, i.now)), "Each one is a bet priced lower than how often bets like it have won. Any single bet can lose."],
    { href: `${siteUrl()}/?view=flags`, label: "See all best bets" },
    i.unsubscribeUrl,
    "You get this morning email because you turned on the digest.",
    "Unsubscribe from the digest",
  );
  // one link per bet, after the heading: "Open in Kismet"
  const links = bets.map((b) => `<p style="margin:0 0 14px"><a href="${siteUrl()}/m/${encodeURIComponent(b.id)}?side=${b.side_index}" style="color:#10b981">Open in Kismet</a></p>`);
  const html = base.html.replace(/<p style="margin:20px 0">/, `${links.join("\n")}\n<p style="margin:20px 0">`);
  const text = [
    "Today's best bets in your topics", "",
    ...bets.flatMap((b) => [line(b, i.now), `Open in Kismet: ${siteUrl()}/m/${encodeURIComponent(b.id)}?side=${b.side_index}`, ""]),
    "Each one is a bet priced lower than how often bets like it have won. Any single bet can lose.", "",
    `See all best bets: ${siteUrl()}/?view=flags`, "",
    `You get this morning email because you turned on the digest. Unsubscribe from the digest: ${i.unsubscribeUrl}`,
    base.text.split("\n").pop()!,
  ].join("\n");
  return { to: i.to, subject, html, text, unsubscribeUrl: i.unsubscribeUrl };
}
