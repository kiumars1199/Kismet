// T-wt3g (#125/#130 review nits), fixture data, paid mock build, Premium. The "combo checker" link in the tray's same-event alert is
// not hidden under the fixed bottom combo tray (or the tab bar) at 375x667 and 390x844: a hit test, without scrolling it into view.
// Screenshots (deviceScaleFactor 1) go to docs/launch/review/wt3g/ when WT3G_SHOTS=1.
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

const shot = async (page: Page, name: string) => { if (process.env.WT3G_SHOTS) await page.screenshot({ path: path.join(__dirname, "../../../docs/launch/review/wt3g", name) }); };

for (const { w, h } of [{ w: 375, h: 667 }, { w: 390, h: 844 }]) {
  test(`the 'combo checker' link in the same-event alert is on screen and not covered by the tray, without scrolling, at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3g-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    await signIn(page, `wt3g-link-${w}-${Date.now()}@example.com`);
    await makePremium(page);
    const meta = (await (await page.request.get("/api/meta")).json()) as { meta: { scanned_at: number } };
    await page.clock.setFixedTime(new Date((meta.meta.scanned_at + 60) * 1000));   // the tray judges "closed" by the browser clock; the fixture scan is days old
    await page.goto("/m/6674485");
    await expect(async () => {   // the first tap can land before the page is hydrated
      if (!(await page.getByRole("button", { name: /In combo/ }).first().isVisible())) await page.getByRole("button", { name: /Add to combo tray/ }).first().click({ timeout: 3_000 });
      await expect(page.getByRole("button", { name: /In combo/ }).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await page.goto("/m/6674492");
    await page.getByRole("button", { name: /Add to combo tray/ }).first().click();
    const link = page.getByRole("alert").filter({ hasText: "already has a bet from this event" }).getByRole("link", { name: "combo checker" });
    await expect(link).toBeVisible();
    await page.waitForTimeout(800);   // whatever the page does to show it has done it; the test itself never scrolls
    await shot(page, `alert-link-${w}.png`);
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    // every point down the link (and its middle), 8 px in from its left edge, is on screen and belongs to the link: not the tray, the tab bar or the button
    const hits = await page.evaluate(({ x, y, h: lh, vh }) => {
      const out: string[] = [];
      for (let dy = 1; dy < lh; dy += 3) {
        const py = y + dy;
        if (py < 0 || py >= vh) { out.push(`offscreen y${Math.round(py)}`); continue; }
        const e = document.elementFromPoint(x, py);
        out.push(e?.closest("a")?.textContent === "combo checker" ? "link" : `${e?.tagName}${e?.closest("[data-testid]") ? ":" + e.closest("[data-testid]")!.getAttribute("data-testid") : ""}`);
      }
      return out;
    }, { x: box.x + 8, y: box.y, h: box.height, vh: h });
    expect(hits.filter((v) => v !== "link"), `link at y ${Math.round(box.y)} to ${Math.round(box.y + box.height)} of ${h}`).toEqual([]);
  });
}
