// /llms.txt (T-281, llmstxt.org): a short Markdown guide to Kismet for AI assistants reading the site for a person.
// Public pages only; no market data. Assistants that need data use the MCP connector (OAuth, a paid plan).
import { DISCLAIMER } from "@/components/shell/Footer";
import { SITE, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export function GET() {
  const u = siteUrl();
  const body = `# ${SITE.name}

> ${SITE.name} shows prediction-market traders which contracts are priced below their estimated win chance, after the
> fee and after the cost of crossing the spread. Every number comes with its basis: sample size, model level and the
> walk-forward backtest record. Flags are the same for everyone; ${SITE.name} gives no personal advice and places no bets.

${DISCLAIMER}

## Public pages

- [How it works](${u}/about): the model, the price check and what the numbers mean
- [Track record](${u}/track-record): walk-forward backtest, calibration and the live settled-bet record
- [Pricing](${u}/pricing): Free, Pro and Premium
- [Terms](${u}/terms), [Privacy](${u}/privacy), [Refunds](${u}/refunds), [Disclaimer](${u}/disclaimer), [Contact](${u}/contact)

## Use ${SITE.name} in an AI assistant (MCP)

- Server URL: ${u}/api/mcp (streamable HTTP, OAuth 2.1 sign-in with your ${SITE.name} account)
- Read-only tools: best_bets, search_markets, get_market, track_record, my_list
- Plans: Premium (up to 60 calls a minute); Pro includes 3 calls a day; not on Free
- Setup steps for Claude, ChatGPT and Cursor: ${u}/account (signed in)

## For crawlers

Market data, Best bets and account pages need a signed-in account and aren't for automated reading. Training
crawlers are not allowed anywhere (see ${u}/robots.txt).
`;
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
