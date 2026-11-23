// T-wt3: every plan can reach the combo checker: signed out, Free and Pro, at 390 and 1440, from /check and from the drawer (or /m).
// Premium's tray and suggested combos stay Premium's; Free sees its daily-check note, Pro does not.
import { expect, test, type Page } from "./fixtures";
import { expectPlanActive } from "./checkout";

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


const SIZES = [{ width: 390, height: 844 }, { width: 1440, height: 900 }];

async function fromCheck(page: Page) {
  await page.goto("/check");
  const link = page.locator("main").getByRole("link", { name: "Check a combo" });
  await expect(link).toBeVisible();
  await expect(async () => {   // next dev can still be hydrating when the first tap lands: tap again until the page has moved
    if (!/\/check\/combo/.test(page.url())) await link.click({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/check\/combo$/, { timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Combo checker" })).toBeVisible();
}
/** Signed in: a card's drawer on /bets. */
async function fromDrawer(page: Page) {
  await page.goto("/bets");
  await page.locator("[data-row] h3 a").first().click();
  const dialog = page.getByRole("dialog", { name: "Market details" });
  const link = dialog.getByRole("link", { name: "Add to combo checker" });
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("button", { name: /^Add to combo tray/ })).toHaveCount(0);   // the Premium tray is not shown to Free or Pro
  // next dev can still be hydrating when the first tap lands: tap again until the page has moved
  await expect(async () => {
    if (!/\/check\/combo/.test(page.url())) await link.click({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/check\/combo\?m=/, { timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("combo-leg"), `note: ${await page.getByTestId("combo-note").innerText().catch(() => "?")}`).toHaveCount(1, { timeout: 30_000 });
}

test("signed out: /check and a bet's page lead to the combo checker at 390 and 1440", async ({ page }) => {
  test.setTimeout(180_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3-${Date.now()}` });
  for (const size of SIZES) {
    await page.setViewportSize(size);
    if (size.width >= 1024) {   // the desktop nav leads to /check for signed-out visitors too
      await page.goto("/about");
      await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Check a bet" })).toHaveAttribute("href", "/check");
    }
    await fromCheck(page);
    await page.goto("/m/6674492");   // the signed-out teaser page
    const link = page.getByRole("link", { name: "Add to combo checker" });
    await expect(link).toBeVisible();
    await expect(async () => {
      if (!/\/check\/combo/.test(page.url())) await link.click({ timeout: 3_000 });
      await expect(page).toHaveURL(/\/check\/combo\?m=6674492/, { timeout: 8_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
    await page.evaluate(() => sessionStorage.clear());
  }
});

test("Free, then Pro: both reach the combo checker from /check and the drawer; /combos says what they have; only Free sees the check note", async ({ page }) => {
  test.setTimeout(420_000);
  await signIn(page, `wt3-${Date.now()}@example.com`);
  const ids = ((await (await page.request.get("/api/markets?limit=20")).json()).rows as { market: { id: string }; side: { side_index: number } }[]);
  expect(ids.length).toBeGreaterThanOrEqual(2);

  for (const plan of ["free", "pro"] as const) {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await fromCheck(page);
      await page.evaluate(() => sessionStorage.clear());
      await fromDrawer(page);
      await page.evaluate(() => sessionStorage.clear());
      // /combos: the checker is theirs, suggested combos and the tray are Premium's
      await page.goto("/combos");
      const box = page.getByTestId("combos-upgrade");
      await expect(box).toContainText("Check any combo you build in the combo checker.");
      await expect(box).toContainText("Premium adds suggested combos and the combo tray.");
      await expect(box.getByRole("link", { name: "Check any combo you build in the combo checker." })).toHaveAttribute("href", "/check/combo");
    }
    // the check note: two legs make "Check this combo" appear
    for (const [i, r] of ids.slice(0, 2).entries()) {   // a full load each: the first leg is kept in sessionStorage for the second
      await page.goto(`/check/combo?m=${r.market.id}&side=${r.side.side_index}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(i + 1, { timeout: 30_000 });
    }
    await expect(page.getByTestId("combo-check-btn")).toBeVisible();
    if (plan === "free") await expect(page.getByTestId("combo-free-note")).toHaveText("Free includes 1 check a day; this combo counts as one.");
    else await expect(page.getByTestId("combo-free-note")).toHaveText("");
    await page.evaluate(() => sessionStorage.clear());
    if (plan === "free") {
      await page.goto("/pricing");
      await page.getByTestId("checkout-pro").click();
      await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
      await expectPlanActive(page);
    }
  }
});

// Review of #89: Free's limit box is part of the result (inside it), so it never pushes the legs down; no shift > 0.02 at 390 or 1440.
test("Free: the daily-limit box sits inside the result and moves nothing (CLS < 0.02 at 390 and 1440)", async ({ page }) => {
  test.setTimeout(240_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3-limit-${Date.now()}` });
  await signIn(page, `wt3-limit-${Date.now()}@example.com`);
  const rows = ((await (await page.request.get("/api/markets?limit=20")).json()).rows as { market: { id: string }; side: { side_index: number } }[]);
  // use the day's one check, so the combo below hits the limit
  const used = await page.request.post("/api/check", { data: { m: rows[0]!.market.id, side: 0 }, headers: { Origin: new URL(page.url()).origin } });
  expect(used.status()).toBe(200);
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/check/combo");
    await page.evaluate(() => sessionStorage.clear());
    for (const [i, r] of rows.slice(1, 3).entries()) {
      await page.goto(`/check/combo?m=${r.market.id}&side=${r.side.side_index}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(i + 1, { timeout: 30_000 });
    }
    await page.waitForTimeout(800);
    const legsTop = (await page.getByTestId("combo-legs").boundingBox())!.y;
    const before = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    await page.getByTestId("combo-check-btn").click();
    const box = page.getByTestId("check-upgrade");
    await expect(box).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    expect(await page.getByRole("region", { name: "Combo result" }).getByTestId("check-upgrade").count(), "inside the result").toBe(1);
    expect((await page.getByTestId("combo-legs").boundingBox())!.y).toBe(legsTop);
    const delta = (await page.evaluate(() => (window as unknown as { __cls: number }).__cls)) - before;
    console.log(`limit box CLS at ${size.width}px: ${delta.toFixed(4)}`);
    expect(delta).toBeLessThan(0.02);
  }
});

// Review of #92: the header link must not crowd the header. It shows from 1440 px only; below that "Check a bet" is in the footer (and
// the phone More menu). At 768, 1024, 1100, 1280 and 1440, for signed out, Free, Pro and Premium: the header is no taller, no nav item
// clips, and the search box is no narrower than it is without the link (and at least 120 px where it had room).
const HEADER_SIZES = [768, 1024, 1100, 1280, 1440];
async function headerAt(page: Page, w: number, path: string, plan: string) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(path);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await page.waitForTimeout(plan === "signed out" ? 400 : 1500);   // the search box and bell load after the first paint
  const m = await page.evaluate(() => {
    const header = document.querySelector("header")!;
    const nav = header.querySelector("nav[aria-label=Main]") as HTMLElement;
    const link = [...nav.querySelectorAll("a")].find((a) => a.textContent?.trim() === "Check a bet") as HTMLElement | undefined;
    const search = header.querySelector("[role=combobox]")?.closest("div[class*='max-w-']") as HTMLElement | null;
    const measure = () => ({ h: Math.round(header.getBoundingClientRect().height), clipped: nav.scrollWidth > nav.clientWidth + 1, search: search ? Math.round(search.getBoundingClientRect().width) : null });
    const withLink = measure();
    const shown = !!link && getComputedStyle(link).display !== "none";
    const prev = link?.style.display ?? "";
    if (link) link.style.display = "none";
    const without = measure();   // what final's header is: the same page with the link gone
    if (link) link.style.display = prev;
    return { withLink, without, shown, hasLink: !!link };
  });
  const tag = `${plan} at ${w}px`;
  console.log(`header ${tag}: link ${m.shown ? "shown" : "hidden"}, height ${m.withLink.h} (final ${m.without.h}), search ${m.withLink.search} (final ${m.without.search}), nav clipped ${m.withLink.clipped}`);
  expect(m.hasLink, tag).toBe(true);
  expect(m.shown, `link shown only from 1440 (${tag})`).toBe(w >= 1440);
  expect(m.withLink.h, `header no taller than final (${tag})`).toBeLessThanOrEqual(m.without.h);
  expect(m.withLink.clipped, `no nav item clips (${tag})`).toBe(m.without.clipped);
  if (m.withLink.search !== null && m.without.search !== null) {
    expect(m.withLink.search, `search no narrower than final (${tag})`).toBeGreaterThanOrEqual(Math.min(m.without.search, 120));
  }
}

test("header: 'Check a bet' from 1440 only, and the header never gets taller, clipped or its search narrower (signed out, Free, Pro, Premium)", async ({ page }) => {
  test.setTimeout(540_000);
  await page.context().setExtraHTTPHeaders({ "x-e2e-device": `wt3-hdr-${Date.now()}` });
  for (const w of HEADER_SIZES) await headerAt(page, w, "/about", "signed out");
  await signIn(page, `wt3-hdr-${Date.now()}@example.com`);
  for (const [plan, next] of [["free", "pro"], ["pro", "premium"], ["premium", null]] as const) {
    for (const w of HEADER_SIZES) await headerAt(page, w, "/bets", plan);
    if (next === "pro") {
      await page.goto("/pricing");
      await page.getByTestId("checkout-pro").click();
      await expect(page).toHaveURL(/\/account\?checkout=success/, { timeout: 45_000 });
      await expectPlanActive(page);
    } else if (next === "premium") {   // a Premium comp through the mock database (service role), as the f05 topics spec does
      const me = await (await page.request.get("/api/me")).json();
      const res = await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, {
        headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" },
      });
      expect(res.status()).toBeLessThan(300);
      expect((await (await page.request.get("/api/me")).json()).tier).toBe("premium");
    }
  }
});

// Review of #92 (T-89c): the same steps as the demo spec, for a signed-in Free account (its /api/me answer adds the check note and
// once read 0.1008 on the 2nd leg): first leg, 2nd leg and scoring each < 0.02 at 390 and 1440, five runs each.
test("Free: first leg, 2nd leg and scoring each shift the page < 0.02 at 390 and 1440 (5 runs each)", async ({ page }) => {
  test.setTimeout(480_000);
  await signIn(page, `wt3-cls-${Date.now()}@example.com`);
  const rows = ((await (await page.request.get("/api/markets?limit=20")).json()).rows as { market: { id: string; event_id: string }; side: { side_index: number } }[]);
  const [a, b] = rows.filter((r, i) => rows.findIndex((x) => x.market.event_id === r.market.event_id) === i);
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  // next dev can abort a load that lands while it compiles: load again (the retry is a fresh load, so its CLS is its own)
  const go = async (url: string) => { try { await page.goto(url); } catch { await page.goto(url); } };
  const cls = () => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    const worst = { first: 0, second: 0, scoring: 0 };
    for (let run = 0; run < 5; run++) {
      await go("/check");
      await page.evaluate(() => sessionStorage.clear());
      await go(`/check/combo?m=${a!.market.id}&side=${a!.side.side_index}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
      await page.waitForTimeout(800);
      worst.first = Math.max(worst.first, await cls());
      await go(`/check/combo?m=${b!.market.id}&side=${b!.side.side_index}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
      await expect(page.getByTestId("combo-free-note")).toHaveText(/Free includes 1 check a day/, { timeout: 30_000 });
      await page.waitForTimeout(800);
      const second = await cls();
      worst.second = Math.max(worst.second, second);
      await page.getByTestId("combo-check-btn").click();
      await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      worst.scoring = Math.max(worst.scoring, (await cls()) - second);
    }
    console.log(`T-89c Free CLS at ${size.width}px, worst of 5: first ${worst.first.toFixed(4)}, 2nd ${worst.second.toFixed(4)}, scoring ${worst.scoring.toFixed(4)}`);
    expect(worst.first).toBeLessThan(0.02);
    expect(worst.second).toBeLessThan(0.02);
    expect(worst.scoring).toBeLessThan(0.02);
  }
});
