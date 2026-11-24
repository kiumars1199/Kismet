// T-wt3h (#134 review), fixture data, paid mock build, Premium, at 375x667 and 390x844:
//  1. the tray's "chances multiply" line reads "<1%" for a product that rounds to 0 (never "≈ 0%" next to "<1%"), and its estimated return never reads a plain "−100%" unless it is exactly that;
//  2. the "." after the "combo checker" link stays on the link's line (it wrapped onto a line of its own at 375).
// Screenshots (deviceScaleFactor 1) go to docs/launch/review/wt3h/ when WT3H_SHOTS=1.
import { expect, test, type Page } from "./fixtures";
import path from "node:path";

async function signIn(page: Page, email: string) {
  await page.goto("/login?next=/account");
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
  await expect(async () => {
    if (new URL(page.url()).pathname === "/onboarding") await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

async function makePremium(page: Page) {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" },
  });
  expect(res.status()).toBeLessThan(300);
  expect((await (await page.request.get("/api/me")).json()).tier).toBe("premium");
}

const shot = async (page: Page, name: string) => { if (process.env.WT3H_SHOTS) await page.screenshot({ path: path.join(__dirname, "../../../docs/launch/review/wt3h", name) }); };

async function setup(page: Page, w: number, h: number, tag: string) {
  await page.setViewportSize({ width: w, height: h });
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3h-${Date.now()}-${Math.random().toString(36).slice(2)}` });
  await signIn(page, `wt3h-${tag}-${w}-${Date.now()}@example.com`);
  await makePremium(page);
  const meta = (await (await page.request.get("/api/meta")).json()) as { meta: { scanned_at: number } };
  const at = meta.meta.scanned_at + 60;
  await page.clock.setFixedTime(new Date(at * 1000));   // the tray judges "closed" by the browser clock; the fixture scan is days old
  return at;
}

for (const { w, h } of [{ w: 375, h: 667 }, { w: 390, h: 844 }]) {
  test(`the tray with five long shots: the multiply line says <1% (not ≈ 0%) and the return never reads a bare −100% at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000);
    const at = await setup(page, w, h, "tray");
    // five long shots from five events, saved in the tray the way the app saves them (current price version, so they are not re-quoted): 5% each, so the product is far below 1%
    const rows = ((await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as { market: { id: string; question: string; event: string; event_id: string; url: string }; side: { side_index: number; outcome: string } }[]);
    const five = rows.filter((r, i) => rows.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, 5);
    expect(five).toHaveLength(5);
    const legs = five.map((r) => ({ market_id: r.market.id, side_index: r.side.side_index, question: r.market.question, outcome: r.side.outcome, event_id: r.market.event_id, event: r.market.event, url: r.market.url, kalshi_ticker: null, ask: 0.5, fee: 0.01, q: 0.06, q_low: 0.05, closes_at: at + 86_400, v: 2 }));
    await page.addInitScript((l) => localStorage.setItem("me-combo-v1", JSON.stringify({ state: { legs: l }, version: 0 })), legs);
    await page.goto("/bets");
    const tray = page.getByTestId("combo-tray");
    await expect(tray).toContainText("5 legs", { timeout: 30_000 });
    await tray.getByRole("button", { expanded: false }).first().click();
    const line = tray.getByText(/chances multiply/);
    await expect(line).toBeVisible();
    await shot(page, `tray-${w}.png`);
    const text = (await tray.innerText()).replace(/\s+/g, " ");
    expect(text, "the multiply line").not.toMatch(/≈ 0%/);
    expect(text, "the multiply line").toMatch(/≈ <1%\./);
    expect(text, "a combo chance above 0 never reads 0% or 100%").not.toMatch(/(?:^|[^\d.<>])(?:0|100)% chance/);
    expect(text.match(/(?:about )?[−-]100%/g) ?? [], "a return that is not exactly −100% says 'about'").not.toContain("−100%");
  });

  test(`the '.' after the 'combo checker' link stays on the link's line at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000);
    await setup(page, w, h, "dot");
    await page.goto("/m/6674485");
    await expect(async () => {
      if (!(await page.getByRole("button", { name: /In combo/ }).first().isVisible())) await page.getByRole("button", { name: /Add to combo tray/ }).first().click({ timeout: 3_000 });
      await expect(page.getByRole("button", { name: /In combo/ }).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await page.goto("/m/6674492");
    await page.getByRole("button", { name: /Add to combo tray/ }).first().click();
    const alert = page.getByRole("alert").filter({ hasText: "already has a bet from this event" });
    const link = alert.getByRole("link", { name: "combo checker" });
    await expect(link).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, `alert-dot-${w}.png`);
    const lb = (await link.boundingBox())!;
    expect(lb.height).toBeGreaterThanOrEqual(44);
    const dot = await alert.evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let last: Text | null = null;
      for (let t = walker.nextNode(); t; t = walker.nextNode()) if ((t.textContent ?? "").trim()) last = t as Text;
      const r = document.createRange();
      r.selectNodeContents(last!);
      const b = r.getBoundingClientRect();
      return { text: last!.textContent, x: b.x, y: b.y, h: b.height };
    });
    expect(dot.text).toBe(".");
    expect(dot.y + dot.h / 2, "the period's line is the link's line").toBeGreaterThanOrEqual(lb.y);
    expect(dot.y + dot.h / 2, "the period's line is the link's line").toBeLessThanOrEqual(lb.y + lb.height);
    expect(dot.x, "right after the link").toBeGreaterThanOrEqual(lb.x + lb.width - 2);
  });
}
