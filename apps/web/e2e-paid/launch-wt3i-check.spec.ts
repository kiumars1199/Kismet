// T-wt3i (#137 review), fixture data, paid mock build, Pro.
//  1. A /check deep link for a price above 99.5% (or below 1%) scores with the market's exact price: the Price field shows 99.9 (not 100), there is no
//     "Price must be between 1% and 99%" error, and Market says / Pays / Edge / Score are numbers. 0.8% scores as 0.8%, not as 1%. Editing the field is guarded again.
//  2. At 375 and 360 the gap above the "combo checker." line is not larger than a normal line gap, and the link is still a 44 px target.
// Screenshots (deviceScaleFactor 1) go to docs/launch/review/wt3i/ when WT3I_SHOTS=1.
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

async function setTier(page: Page, tier: "pro" | "premium") {
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
    headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier },
  });
  expect(res.status()).toBeLessThan(300);
  expect((await (await page.request.get("/api/me")).json()).tier).toBe(tier);
}

const shot = async (page: Page, name: string) => { if (process.env.WT3I_SHOTS) await page.screenshot({ path: path.join(__dirname, "../../../docs/launch/review/wt3i", name) }); };
const txt = (page: Page, id: string) => page.getByTestId(id).innerText();

for (const { w, h } of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  test(`/check deep links for a 99.9% price and a 0.8% price score with the exact price at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await signIn(page, `wt3i-chk-${w}-${Date.now()}@example.com`);
    await setTier(page, "pro");

    await page.goto("/check?m=6949344&side=1");   // ask 0.999
    await expect(page.getByTestId("check-price")).toHaveValue("99.9", { timeout: 30_000 });
    await expect(page.getByTestId("check-error")).toHaveText("");
    await expect(page.getByText("Price must be between")).toHaveCount(0);
    expect(await txt(page, "chk-market")).toBe(">99%");
    for (const id of ["chk-mult", "chk-edge", "chk-return", "chk-score"]) expect(await txt(page, id), id).not.toBe("—");
    await shot(page, `check-99-9-${w}.png`);
    await page.getByTestId("check-price").fill("99.9");   // typed (even the same text) is still the field's value: unchanged text keeps the exact price
    await expect(page.getByTestId("check-error")).toHaveText("");
    await page.getByTestId("check-price").fill("99.8");   // a typed price above 99% is guarded again
    await expect(page.getByTestId("check-error")).toHaveText("Price must be between 1% and 99%.");

    await page.goto("/check?m=7029427&side=0");   // ask 0.008, fee 0.0003
    await expect(page.getByTestId("check-price")).toHaveValue("0.8", { timeout: 30_000 });
    await expect(page.getByTestId("check-error")).toHaveText("");
    expect(await txt(page, "chk-mult"), "scored at 0.8%, not at 1% (95x)").toBe("120x");
    await shot(page, `check-0-8-${w}.png`);
    await page.getByTestId("check-price").fill("0.5");
    await expect(page.getByTestId("check-error")).toHaveText("Price must be between 1% and 99%.");
  });
}

for (const { w, h } of [{ w: 375, h: 667 }, { w: 360, h: 800 }]) {
  test(`the 'combo checker' line has an even gap above it and keeps a 44 px target at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: w, height: h });
    await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3i-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    await signIn(page, `wt3i-gap-${w}-${Date.now()}@example.com`);
    await setTier(page, "premium");
    const meta = (await (await page.request.get("/api/meta")).json()) as { meta: { scanned_at: number } };
    await page.clock.setFixedTime(new Date((meta.meta.scanned_at + 60) * 1000));   // the tray judges "closed" by the browser clock; the fixture scan is days old
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
    await shot(page, `alert-gap-${w}.png`);
    const lb = (await link.boundingBox())!;
    expect(lb.height).toBeGreaterThanOrEqual(44);
    // the gap between the text line above the link and the link's own text, against the line height of the alert's text
    const m = await alert.evaluate((el) => {
      const link = el.querySelector("a")!;
      const lineH = parseFloat(getComputedStyle(el).lineHeight);
      const r = document.createRange();
      r.selectNodeContents(link);
      const lt = r.getBoundingClientRect();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let above = 0;
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (link.contains(t) || !(t.textContent ?? "").trim()) continue;
        const rr = document.createRange(); rr.selectNodeContents(t);
        for (const q of rr.getClientRects()) if (q.bottom <= lt.top + 1) above = Math.max(above, q.bottom);
      }
      return { gap: lt.top - above, lineH };
    });
    console.log(`T-wt3i gap above the link text at ${w}: ${m.gap.toFixed(1)} px (line height ${m.lineH})`);
    expect(m.gap, `gap above the link text (line height ${m.lineH})`).toBeLessThanOrEqual(10);
  });
}
