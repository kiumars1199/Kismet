// Reviewer probe, F13 round 2 (E2E mock, next dev): public share image, og:image, crawler UAs, ?ref=, share sheet per tier.
import { expect, test, type Page } from "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/apps/web/node_modules/@playwright/test";
import { writeFileSync } from "node:fs";
const OUT = "/home/user/MarketEdge/.claude/worktrees/agent-ac3ec7df000229278/docs/launch/review/f13-reviewer/round2";
async function signUp(page: Page, email: string) {
  await page.goto("/login");
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 90_000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await page.waitForURL(/\/(onboarding|account|bets)/, { timeout: 90_000 });
}
test("signed out: OG route, og:image, crawler user agents", async ({ request, playwright, baseURL }) => {
  test.setTimeout(300_000);
  const flags = (await (await request.get("/api/flags")).json()) as { rows?: { market: { id: string } }[] };
  console.log("signed-out /api/flags status rows", flags.rows?.length ?? "none");
  // ids from the fixture flags file (signed out may not get /api/flags)
  const ids = ["6674176", "6654461", "6674492", "7077573"];
  for (const id of ids) for (const side of ["", "?side=0", "?side=1"]) {
    const r = await request.get(`/api/og/bet/${id}${side}`);
    const body = await r.body();
    console.log(`OG ${id}${side} -> ${r.status()} ${r.headers()["content-type"]} ${r.headers()["cache-control"]} ${body.length}B`);
    if (r.status() === 200) writeFileSync(`${OUT}/og/${id}${side.replace("?side=", "-side")}.png`, body);
  }
  console.log("OG unknown ->", (await request.get("/api/og/bet/nope")).status());
  for (const ua of ["Twitterbot/1.0", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)", "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15 facebookexternalhit/1.1 Facebot Twitterbot/1.0", "Discordbot/2.0", "GPTBot/1.1", "ClaudeBot/1.0"]) {
    const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "user-agent": ua } });
    const img = await ctx.get("/api/og/bet/6674176");
    const page = await ctx.get("/m/6674176?ref=abcd2345");
    const html = await page.text();
    const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
    const tw = /<meta name="twitter:image" content="([^"]+)"/.exec(html)?.[1];
    const desc = /<meta property="og:description" content="([^"]+)"/.exec(html)?.[1];
    console.log(`UA ${ua.slice(0, 40)}: img ${img.status()} page ${page.status()} og:image=${og} twitter:image=${tw} og:desc=${desc}`);
    await ctx.dispose();
  }
  const r = await request.get("/robots.txt"); console.log("robots:\n" + (await r.text()).split("\n").filter((l) => /og|User-agent: \*|Allow|Disallow/.test(l)).slice(0, 12).join("\n"));
  // ?ref= with a bad code is ignored; a cross-origin POST is ignored
  const bad = await request.post("/api/invite/ref", { data: { code: "../../x" }, headers: { origin: baseURL! } });
  console.log("ref bad code", bad.status(), bad.headers()["set-cookie"] ?? "no cookie");
  const xo = await request.post("/api/invite/ref", { data: { code: "abcd2345" }, headers: { origin: "https://evil.example" } });
  console.log("ref cross-origin", xo.status(), xo.headers()["set-cookie"] ?? "no cookie");
});
for (const w of [390, 1440]) test(`share sheet per tier at ${w}px`, async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  await page.addInitScript(() => { try { localStorage.removeItem("me:v1:tour"); } catch {} });
  await signUp(page, `f13r2-${w}-${Date.now()}@example.com`);
  if (new URL(page.url()).pathname === "/onboarding") { await page.waitForLoadState("networkidle"); await page.getByRole("button", { name: "Skip setup" }).click(); }
  const me = await (await page.request.get("/api/me")).json();
  for (const tier of ["free", "pro", "premium"]) {
    if (tier !== "free") await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier } });
    const flags = await (await page.request.get("/api/flags")).json();
    const id = flags.rows[0].market.id as string;
    await page.goto(`/bets?m=${id}&side=0`);
    await page.waitForLoadState("networkidle");
    
    // the drawer's own figures for this side
    const drawer = await page.locator("body").innerText();
    const dFig = { pays: /Pays\s+([0-9.]+x)/.exec(drawer)?.[1], wins: /wins about (1 in \d+)/i.exec(drawer)?.[1], won: /won (\d+)% before/i.exec(drawer)?.[1] };
    await page.getByTestId("share-bet").click();
    const dlg = page.getByRole("dialog").filter({ has: page.getByRole("img", { name: "Share card for this bet" }) }).last();
    await expect(dlg.getByRole("img", { name: "Share card for this bet" })).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => dlg.getByRole("img", { name: "Share card for this bet" }).evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 60_000 }).toBe(1200);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await expect.poll(async () => { await dlg.getByRole("button", { name: "Copy link" }).first().click(); return page.evaluate(() => navigator.clipboard.readText()); }, { timeout: 30_000 }).toMatch(/\?ref=[a-z0-9]{8}$/);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const hs = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const txt = await dlg.innerText();
    console.log(`${w} ${tier} id=${id} drawer=${JSON.stringify(dFig)} link=${copied.replace(/^https?:\/\/[^/]+/, "")} hscroll=${hs} cents=${/¢|\bcents?\b/i.test(txt)} counter=${/\d of 5/.exec(txt)?.[0]}`);
    await page.screenshot({ path: `${OUT}/${w}-${tier}-share-sheet.png` });
    await page.keyboard.press("Escape");
  }
});
