// F13: invite link + QR + live counter, the 5-sign-up reward, and the share sheet. Supabase: the in-app mock.
// Five browsers open the inviter's link and sign up with a confirmed email; the inviter's /account goes 0 -> 5 of 5 and
// the plan becomes Premium (comp). The share sheet in the bet drawer shows the card image (1200x630) and the same counter.
import { expect, test, type Browser, type Page } from "./fixtures";

import path from "node:path";

const SHOTS = path.resolve(__dirname, "../../../docs/launch/review/f13");

async function signIn(page: Page, email: string, next = "/account") {
  await page.goto(`/login?next=${next}`);
  await expect(async () => {
    await page.getByRole("tab", { name: "Email link" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });
  const { url } = await (await page.request.get(`/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await page.waitForURL(/\/(onboarding|account)/, { timeout: 60_000 });
}

/** A new browser follows the inviter's link, then signs up. */
async function joinFrom(browser: Browser, link: string, n: number) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(link);
  expect(res?.url()).toMatch(/\/signup/);   // the link sets the cookie and sends them to sign up
  await signIn(page, `f13-friend-${n}-${Date.now()}@example.com`);
  await ctx.close();
}


test("invite link, QR, live 0..5 counter, reward; share sheet in the drawer", async ({ page, browser }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, `f13-inviter-${Date.now()}@example.com`);
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click();
  await page.goto("/account");

  // link, QR and counter on /account
  const panel = page.getByTestId("invite-panel");
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("invite-counter")).toContainText("0 of 5");
  await expect(page.getByTestId("invite-qr").locator("svg")).toBeVisible({ timeout: 30_000 });
  const link = await page.getByRole("textbox", { name: "Your invite link" }).inputValue();
  expect(link).toMatch(/\/invite\/[a-z0-9]{8}$/);
  expect(link.startsWith("http://localhost")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: `${SHOTS}/account-0-of-5-1440.png`, fullPage: true });

  // the inviter's own browser opening their own link and signing in again never adds to the count
  // (same account: rejected as "self"; covered in lib/invites/core.test.ts)

  for (let n = 1; n <= 3; n++) await joinFrom(browser, link, n);

  // share sheet from the drawer: image is 1200x630, counter reads 3 of 5
  const flags = await (await page.request.get("/api/flags")).json();
  const id = flags.rows[0].market.id as string;
  await page.goto(`/bets?m=${id}&side=0`);
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Skip tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByTestId("share-bet").click();
  const img = page.getByRole("img", { name: "Share card for this bet" });
  await expect(img).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight]), { timeout: 60_000 }).toEqual([1200, 630]);
  await expect(page.getByRole("dialog").getByTestId("invite-counter")).toContainText("3 of 5", { timeout: 30_000 });
  await page.screenshot({ path: `${SHOTS}/share-sheet-3-of-5-1440.png` });

  // the shared link is signed by the server and carries the sharer's invite code
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy link" }).first().click();   // the sheet's own (the invite panel below has another)
  const code = link.split("/").pop()!;
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  const m = new RegExp(`^http://localhost:${new URL(page.url()).port}(/m/${id}\\?ref=${code}&s=(\\d)&sig=([A-Za-z0-9_-]{22}))$`).exec(shared);
  expect(m, shared).not.toBeNull();
  const [, sharedPath, sharedSide, sharedSig] = m!;
  await page.keyboard.press("Escape");

  // share previews work signed out. A signed link's image shows the numbers, and its description says the same; an
  // unsigned or forged request gets the teaser card and the sign-up line (T-276: no model output without an account)
  const origin = new URL(page.url()).origin;
  const crawler = await browser.newContext({ baseURL: origin });
  const cp = await crawler.newPage();
  const bytes = async (u: string) => { const r = await crawler.request.get(u); expect(r.status(), u).toBe(200); expect(r.headers()["content-type"]).toContain("image/png"); return r.body(); };
  const numbers = await bytes(`/api/og/bet/${id}?s=${sharedSide}&sig=${sharedSig}`);
  const bare = await bytes(`/api/og/bet/${id}`);
  const forged = await bytes(`/api/og/bet/${id}?s=${sharedSide}&sig=AAAAAAAAAAAAAAAAAAAAAA`);
  expect(bare.equals(forged)).toBe(true);
  expect(numbers.equals(bare)).toBe(false);
  const signedHtml = await (await crawler.request.get(sharedPath!)).text();
  expect(signedHtml).toMatch(new RegExp(`<meta property="og:image" content="[^"]*/api/og/bet/${id}\\?s=${sharedSide}&amp;sig=${sharedSig}"`));
  expect(signedHtml).toMatch(new RegExp(`<meta name="twitter:image" content="[^"]*sig=${sharedSig}"`));
  expect(signedHtml).toMatch(/<meta name="description" content="Pays \d/);
  const bareHtml = await (await crawler.request.get(`/m/${id}`)).text();
  expect(bareHtml).toMatch(new RegExp(`<meta property="og:image" content="[^"]*/api/og/bet/${id}"`));
  expect(bareHtml).toMatch(/<meta name="description" content="[^"]*Sign up free/);
  expect(bareHtml).not.toMatch(/content="Pays /);
  // and the ?ref= on a shared link is remembered for the sign-up
  await cp.goto(sharedPath!);
  await expect.poll(async () => (await crawler.cookies()).some((c) => c.name === "me_invite" && c.value === code), { timeout: 30_000 }).toBe(true);
  expect((await crawler.request.get(`/api/share/link?m=${id}`)).status()).toBe(401);   // only a signed-in person can make a signed link
  await crawler.close();

  for (let n = 4; n <= 5; n++) await joinFrom(browser, link, n);
  await page.goto("/account");
  await expect(page.getByTestId("invite-counter")).toContainText("5 of 5", { timeout: 30_000 });
  await expect(page.getByTestId("invite-rewarded")).toBeVisible();
  await expect(page.getByTestId("plan-name")).toHaveText("Premium");
  await page.screenshot({ path: `${SHOTS}/account-5-of-5-premium-1440.png`, fullPage: true });
  // "a 6th sign-up changes nothing" (the reward is once) is covered by test/invites-sql.test.ts and lib/invites/server.test.ts;
  // not repeated here: each extra sign-up costs the e2e dev server memory.
});

test("a bad invite code is ignored and a signed-out visitor can't read /api/invite", async ({ page, request }) => {
  const res = await page.goto("/invite/not-a-code!");
  expect(res?.url()).toMatch(/\/signup/);
  expect((await request.get("/api/invite")).status()).toBe(401);
});

test("at 390 px: /account invite panel and the share sheet fit, no horizontal scroll, CLS under 0.1", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, `f13-phone-${Date.now()}@example.com`);
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click();
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/account");
  await expect(page.getByTestId("invite-qr").locator("svg")).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1_500);
  const shift = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  console.log(`CLS /account (invite panel) at 390px: ${shift.toFixed(4)}`);
  expect(shift).toBeLessThan(0.1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByTestId("invite-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/account-390.png` });

  const flags = await (await page.request.get("/api/flags")).json();
  await page.goto(`/bets?m=${flags.rows[0].market.id}&side=0`);
  await page.waitForLoadState("networkidle");
  const skipTour = page.getByRole("button", { name: "Skip tour" });
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.getByTestId("share-bet").click();
  await expect(page.getByRole("img", { name: "Share card for this bet" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("dialog").getByTestId("invite-counter")).toContainText("0 of 5", { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: `${SHOTS}/share-sheet-390.png` });
});
