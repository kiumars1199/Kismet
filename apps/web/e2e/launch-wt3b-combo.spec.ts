// T-wt3b (walk-through 3): the combo checker keeps its legs in the URL (reload and share), restores without a shift, scores without a
// shift, and tells you what to do about same-event legs. Fixture data, demo server.
import { expect, test, type Page } from "@playwright/test";

type Row = { market: { id: string; event_id: string }; side: { side_index: number } };
const rows = async (page: Page): Promise<Row[]> => (await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as Row[];
const distinct = (all: Row[], n: number) => all.filter((r, i) => all.findIndex((x) => x.market.event_id === r.market.event_id) === i).slice(0, n);
const legsQuery = (rs: Row[]) => rs.map((r) => `${r.market.id}:${r.side.side_index}`).join(",");
const SIZES = [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]] as const;
const watchCls = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

// 1. Legs kept in this tab come back on a fresh mount without moving the page: 2, 3 and 4 legs, five runs each, < 0.02.
for (const [name, size] of SIZES) {
  test(`restoring 2, 3 and 4 legs on a fresh load shifts nothing: CLS < 0.02 at ${name}px (5 runs each)`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize(size);
    await page.addInitScript(watchCls);
    const all = distinct(await rows(page), 4);
    const worst: Record<string, number> = {};
    for (const n of [2, 3, 4]) {
      for (let run = 0; run < 5; run++) {
        await page.goto("/check/combo");
        await page.evaluate(() => sessionStorage.clear());
        await page.goto(`/check/combo?legs=${legsQuery(all.slice(0, n))}`);   // loads the legs; they are kept in this tab
        await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
        await page.goto("/check/combo");   // no legs in the URL: restored from this tab
        await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
        await page.waitForTimeout(700);
        worst[`${n}-stored`] = Math.max(worst[`${n}-stored`] ?? 0, await cls(page));
        await page.goto(`/check/combo?legs=${legsQuery(all.slice(0, n))}`);   // a reload / shared link
        await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
        await page.waitForTimeout(700);
        worst[`${n}-url`] = Math.max(worst[`${n}-url`] ?? 0, await cls(page));
      }
    }
    console.log(`T-wt3b restore CLS at ${name}px, worst of 5: ${Object.entries(worst).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(", ")}`);
    for (const [k, v] of Object.entries(worst)) expect(v, k).toBeLessThan(0.02);
  });

  // 2. Tapping "Check this combo" when the answer takes 900 ms: nothing moves (3 and 4 legs).
  test(`scoring 3 and 4 legs after a 900 ms answer shifts nothing: CLS < 0.02 at ${name}px`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(size);
    await page.addInitScript(watchCls);
    await page.route("**/api/check/combo", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); await r.continue(); });
    const all = distinct(await rows(page), 4);
    const out: string[] = [];
    for (const n of [3, 4]) {
      await page.goto("/check/combo");
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(`/check/combo?legs=${legsQuery(all.slice(0, n))}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
      await page.waitForTimeout(700);
      const before = await cls(page);
      await page.getByTestId("combo-check-btn").click();
      await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      const delta = (await cls(page)) - before;
      out.push(`${n} legs ${delta.toFixed(4)}`);
      expect(delta, `${n} legs`).toBeLessThan(0.02);
    }
    console.log(`T-wt3b scoring CLS (900 ms answer) at ${name}px: ${out.join(", ")}`);
  });
}

// 3. Share: "Copy link" encodes every leg; opening it loads and scores them.
test("Copy link puts every leg in the URL; opening it loads the legs and scores them", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const ctx = page.context();
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const all = distinct(await rows(page), 3);
  await page.goto(`/check/combo?legs=${legsQuery(all)}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(3, { timeout: 30_000 });
  const copy = page.getByRole("button", { name: "Copy link" });
  await expect(copy).toBeVisible();
  expect((await copy.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await copy.click();
  await expect(page.getByTestId("combo-copied")).toHaveText("Link copied");
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(url).pathname).toBe("/check/combo");
  expect(new URL(url).searchParams.get("legs")).toBe(legsQuery(all));
  expect(new URL(url).searchParams.get("check")).toBe("1");
  const other = await (await browser.newContext()).newPage();   // a different tab with nothing stored
  await other.goto(url);
  await expect(other.getByTestId("combo-leg")).toHaveCount(3, { timeout: 30_000 });
  await expect(other.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
  await other.context().close();
});

test("a link with bad or too many legs is cleaned: bad ids and sides dropped, at most 10", async ({ page }) => {
  const all = distinct(await rows(page), 2);
  await page.goto(`/check/combo?legs=${legsQuery(all)},nope!:1,${all[0]!.market.id}:7,%3Cb%3E:0`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.goto(`/check/combo?legs=${Array.from({ length: 14 }, (_, i) => `x${i}:0`).join(",")}`);
  await expect(page.getByTestId("combo-note")).toBeVisible();
  expect(await page.getByTestId("combo-leg").count()).toBeLessThanOrEqual(10);
});

// 4. ?m= is consumed: the URL becomes the legs, a reload keeps them, and a removed leg stays removed.
test("?m= is dropped from the URL after the add; reload keeps the legs; a removed leg stays removed", async ({ page }) => {
  test.setTimeout(120_000);
  const [a, b] = distinct(await rows(page), 2);
  await page.goto(`/check/combo?m=${a!.market.id}&side=${a!.side.side_index}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get("m")).toBeNull();
  expect(new URL(page.url()).searchParams.get("legs")).toBe(`${a!.market.id}:${a!.side.side_index}`);
  await page.reload();
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId("combo-note")).not.toContainText("already in your combo");
  await page.goto(`/check/combo?m=${b!.market.id}&side=${b!.side.side_index}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await expect(page.getByTestId("combo-leg")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });   // the removed leg does not come back
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await page.reload();
  await expect(page.getByTestId("combo-msg")).toContainText("Add at least two");
  expect(new URL(page.url()).search).toBe("");
});

test("a scored combo is scored again after a reload (the URL keeps check=1)", async ({ page }) => {
  const all = distinct(await rows(page), 2);
  await page.goto(`/check/combo?legs=${legsQuery(all)}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get("check")).toBe("1");
  await page.reload();
  await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
});

// 5. Same-event legs: no score, so the page says which leg to drop.
test("same-event legs: the warning says 'Drop one of the two <event> bets.' with a clean event name", async ({ page }) => {
  const all = await rows(page);
  const byEvent = new Map<string, Row[]>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].find((l) => new Set(l.map((r) => r.market.id)).size >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const two = [...new Map(pair!.map((r) => [r.market.id, r])).values()].slice(0, 2);
  await page.goto(`/check/combo?legs=${legsQuery(two)}&check=1`);
  const box = page.getByTestId("combo-same-event");
  await expect(box).toBeVisible({ timeout: 30_000 });
  await expect(box).toContainText(/Drop one of the two .+ bets\./);
  expect(await box.innerText()).not.toMatch(/more markets/i);
});

// Review of #96: an empty combo checker is not padded to a tall page: the footer starts inside the first view at 1440 and stays close
// below the card at 390 (the tall reserve applies once there is a leg, a ?m=/?legs= link, or the person has started adding).
test("the empty page: footer inside the first view at 1440, close below the card at 390", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/check/combo");
  await expect(page.getByTestId("combo-msg")).toBeVisible();
  const f1440 = await page.locator("footer").evaluate((el) => el.getBoundingClientRect().top);
  console.log(`empty page footer top at 1440px: ${Math.round(f1440)}`);
  expect(f1440).toBeLessThan(900);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/check/combo");
  await expect(page.getByTestId("combo-msg")).toBeVisible();
  const m = await page.evaluate(() => ({ card: document.querySelector("section[aria-label='Combo result']")!.getBoundingClientRect().bottom, footer: document.querySelector("footer")!.getBoundingClientRect().top }));
  console.log(`empty page at 390px: card bottom ${Math.round(m.card)}, footer top ${Math.round(m.footer)}`);
  expect(m.footer - m.card, "footer close below the card").toBeLessThan(200);
});

test("adding the first leg by hand after a slow lookup does not shift the page (CLS < 0.02 at 390 and 1440)", async ({ browser }) => {
  test.setTimeout(120_000);
  for (const [name, size] of SIZES) {
    const ctx = await browser.newContext({ viewport: size, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(watchCls);
    await page.route("**/api/check/leg", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); await r.continue(); });
    const [a] = distinct(await rows(page), 1);
    await page.goto("/check/combo");
    await expect(page.getByTestId("combo-msg")).toBeVisible();
    const before = await cls(page);
    await page.getByLabel("Add a bet by link or words").fill(`https://polymarket.com/event/x-${a!.market.id}`);   // a link that is not ours: the lookup takes its time and says so
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForTimeout(1600);
    const delta = (await cls(page)) - before;
    console.log(`first Add (slow answer) at ${name}px: ${delta.toFixed(4)}`);
    expect(delta, name).toBeLessThan(0.02);
    await ctx.close();
  }
});

// Old shared links (?m=<id>&side=<n>, or just ?m=<id>) still work: the leg is added, then the URL turns into ?legs=.
test("an old ?m= link still loads its leg (with a side, and without one), and the URL becomes ?legs=", async ({ page }) => {
  test.setTimeout(120_000);
  const [a, b] = distinct(await rows(page), 2);
  await page.goto(`/check/combo?m=${a!.market.id}&side=${a!.side.side_index}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get("legs")).toBe(`${a!.market.id}:${a!.side.side_index}`);
  const fresh = await page.context().newPage();   // another tab: nothing stored, an old link with no side
  await fresh.goto(`/check/combo?m=${b!.market.id}`);
  await expect(fresh.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => new URL(fresh.url()).searchParams.get("legs")).toBe(`${b!.market.id}:0`);
  expect(new URL(fresh.url()).searchParams.get("m")).toBeNull();
  await fresh.close();
});

// T-wt3d. The 3rd and 4th leg added by a tap on a search result (a slow lookup) shift nothing: the list holds room for the
// incoming leg the moment it is tapped (inside the input window), then the leg lands in it. 2 -> 3 -> 4 legs, 900 ms lookup, 5 runs.
for (const [name, size] of SIZES) {
  test(`adding the 3rd and 4th leg from a search result (900 ms lookup) shifts nothing: CLS < 0.02 at ${name}px (5 runs)`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize(size);
    await page.addInitScript(watchCls);
    await page.route("**/api/check/leg", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); await r.continue(); });
    const all = await rows(page);
    const picks = distinct(all, 4);
    const worst = { third: 0, fourth: 0 };
    for (let run = 0; run < 5; run++) {
      await page.goto("/check/combo");
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(`/check/combo?legs=${legsQuery(picks.slice(0, 2))}`);
      await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
      await page.waitForTimeout(600);
      for (const [i, key] of (["third", "fourth"] as const).entries()) {
        const target = picks[2 + i]!;
        // find the market's own words in the result list: search for the first words of its question
        const q = await page.evaluate(async ([m, s]) => {
          const r = await fetch("/api/check/leg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ m, side: Number(s) }) });
          return ((await r.json()) as { market: { question: string } }).market.question;
        }, [target.market.id, String(target.side.side_index)]);
        await page.getByLabel("Add a bet by link or words").fill(q.split(/\s+/).slice(0, 3).join(" "));
        await page.getByRole("button", { name: "Add", exact: true }).click();
        const hit = page.getByTestId("combo-hits").getByRole("button").filter({ hasText: q.slice(0, 25) }).first();
        await expect(hit).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(700);   // the search answer has landed and settled; what follows is the tap on a result
        const afterSearch = await cls(page);
        await hit.click();   // the lookup now takes 900 ms
        await expect(page.getByTestId("combo-leg")).toHaveCount(3 + i, { timeout: 20_000 });
        await page.waitForTimeout(700);
        worst[key] = Math.max(worst[key], (await cls(page)) - afterSearch);
      }
    }
    console.log(`T-wt3d add-leg CLS (900 ms lookup) at ${name}px, worst of 5: 2->3 ${worst.third.toFixed(4)}, 3->4 ${worst.fourth.toFixed(4)}`);
    expect(worst.third).toBeLessThan(0.02);
    expect(worst.fourth).toBeLessThan(0.02);
  });
}

// On touch devices the button opens the share sheet, so it says "Share link"; elsewhere it copies: "Copy link".
test("the link button says 'Share link' on a touch device and 'Copy link' with a mouse", async ({ browser, page }) => {
  const [a, b] = distinct(await rows(page), 2);
  const url = `/check/combo?legs=${legsQuery([a!, b!])}`;
  await page.goto(url);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Share link" })).toHaveCount(0);
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: test.info().project.use.baseURL });
  const tp = await touch.newPage();
  await tp.goto(url);
  await expect(tp.getByRole("button", { name: "Share link" })).toBeVisible({ timeout: 30_000 });
  await expect(tp.getByRole("button", { name: "Copy link" })).toHaveCount(0);
  await touch.close();
});

// T-wt3e N1: two legs from one event show the same-event note BEFORE any score (it is free: the event ids are known), with no check
// spent, and loading them shifts nothing. N3: the leg lines and the combined chance say "(cautious)" like the tray.
test("same-event legs: the note shows before the tap (no check spent), and loading them shifts nothing (5 runs, 390 and 1440)", async ({ browser, page }) => {
  test.setTimeout(300_000);
  const all = await rows(page);
  const byEvent = new Map<string, Row[]>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].find((l) => new Set(l.map((r) => r.market.id)).size >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const two = [...new Map(pair!.map((r) => [r.market.id, r])).values()].slice(0, 2);
  const out: string[] = [];
  for (const [name, size] of SIZES) {
    let worst = 0;
    for (let run = 0; run < 5; run++) {
      const ctx = await browser.newContext({ viewport: size, baseURL: test.info().project.use.baseURL });
      const p = await ctx.newPage();
      let posts = 0;
      p.on("request", (r) => { if (r.method() === "POST" && new URL(r.url()).pathname === "/api/check/combo") posts++; });
      await p.addInitScript(watchCls);
      await p.goto(`/check/combo?legs=${legsQuery(two)}`);
      await expect(p.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
      const note = p.getByTestId("combo-same-event");
      await expect(note).toBeVisible({ timeout: 15_000 });
      await expect(note).toContainText("move together");
      await expect(note).toContainText(/Drop one of the two .+ bets\./);
      await p.waitForTimeout(700);
      expect(posts, "no check spent for a free note").toBe(0);
      worst = Math.max(worst, await cls(p));
      await ctx.close();
    }
    out.push(`${name}px ${worst.toFixed(4)}`);
    expect(worst, name).toBeLessThan(0.02);
  }
  console.log(`T-wt3e same-event note on load, worst of 5: ${out.join(", ")}`);
});

test("leg lines and the combined chance are labelled '(cautious)' once scored", async ({ page }) => {
  const [a, b] = distinct(await rows(page), 2);
  await page.goto(`/check/combo?legs=${legsQuery([a!, b!])}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
  for (const t of await page.getByTestId("combo-leg").locator("p").filter({ hasText: /^Bet / }).allInnerTexts()) expect(t).toMatch(/\d+% chance \(cautious\)/);
  await expect(page.locator("dt", { hasText: "Combined chance" })).toHaveText("Combined chance (cautious)");
});

// T-wt3e (review of #108): a REFUSED add (duplicate, 404, network error) must not shift the page either: the room held at the tap is kept
// (not given back when the lookup refuses), and a bet that is already a leg is refused on the page without a lookup or a reserve.
for (const [name, size] of SIZES) {
  for (const n of [2, 4]) {
    test(`refused adds (duplicate, 404, network error) after a 900 ms lookup shift nothing: ${n} legs at ${name}px (CLS < 0.02)`, async ({ browser, page }) => {
      test.setTimeout(240_000);
      const picks = distinct(await rows(page), n);
      const ctx = await browser.newContext({ viewport: size, baseURL: test.info().project.use.baseURL });
      const p = await ctx.newPage();
      await p.addInitScript(watchCls);
      let mode: "slow" | "abort" = "slow";
      await p.route("**/api/check/leg", async (r) => { await new Promise((ok) => setTimeout(ok, 900)); if (mode === "abort") await r.abort("failed"); else await r.continue(); });
      await p.goto(`/check/combo?legs=${legsQuery(picks)}`);
      await expect(p.getByTestId("combo-leg")).toHaveCount(n, { timeout: 30_000 });
      await p.waitForTimeout(800);
      const input = p.getByLabel("Add a bet by link or words");
      const note = p.getByTestId("combo-note");
      // a real keystroke first (the next keystroke gives a refusal's room back, inside the input window), then the pasted value
      const typeIn = async (value: string) => { await input.click(); await input.press("End"); await input.press("x"); await input.fill(value); };   // the tap that focuses the field, like a person
      const out: string[] = [];
      const step = async (label: string, run: () => Promise<void>, expectNote: RegExp) => {
        const before = await cls(p);
        await run();
        await expect(note).toHaveText(expectNote, { timeout: 20_000 });
        await p.waitForTimeout(800);
        const d = (await cls(p)) - before;
        out.push(`${label} ${d.toFixed(4)}`);
        expect(d, label).toBeLessThan(0.02);
      };
      // 404: a link to a market that is not ours
      await step("404", async () => { await typeIn("https://polymarket.com/event/not-a-real-market-xyz"); await p.getByRole("button", { name: "Add", exact: true }).click(); }, /find an open market/);
      // network error
      mode = "abort";
      await step("network", async () => { await typeIn("https://polymarket.com/event/anything-else-abc"); await p.getByRole("button", { name: "Add", exact: true }).click(); }, /Couldn't reach Kismet/);
      mode = "slow";
      // duplicate: search for a bet that is already a leg and tap its result
      const q = await p.evaluate(async ([m, s]) => {
        const r = await fetch("/api/check/leg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ m, side: Number(s) }) });
        return ((await r.json()) as { market: { question: string } }).market.question;
      }, [picks[0]!.market.id, String(picks[0]!.side.side_index)]);
      await typeIn(q.split(/\s+/).slice(0, 3).join(" "));
      await p.getByRole("button", { name: "Add", exact: true }).click();
      const hit = p.getByTestId("combo-hits").getByRole("button").filter({ hasText: q.slice(0, 25) }).first();
      await expect(hit).toBeVisible({ timeout: 20_000 });
      await p.waitForTimeout(700);
      let lookups = 0;
      p.on("request", (r) => { if (r.method() === "POST" && new URL(r.url()).pathname === "/api/check/leg") lookups++; });
      await step("duplicate", async () => { await hit.click(); }, /already in your combo/);
      expect(lookups, "a bet that is already a leg is refused without a lookup").toBe(0);
      console.log(`T-wt3e refused adds CLS, ${n} legs at ${name}px: ${out.join(", ")}`);
      await ctx.close();
    });
  }
}

// T-wt3f 1: after a refused add (404, network error) the room it held is given back on the NEXT KEYSTROKE (user input, so no layout shift
// is counted), never by itself.
for (const [name, size] of SIZES) {
  test(`a refused add keeps its room until the next keystroke, then gives it back (no shift without input) at ${name}px`, async ({ browser, page }) => {
    test.setTimeout(180_000);
    const picks = distinct(await rows(page), 2);
    const ctx = await browser.newContext({ viewport: size, baseURL: test.info().project.use.baseURL });
    const p = await ctx.newPage();
    await p.addInitScript(watchCls);
    await p.route("**/api/check/leg", async (r) => { await new Promise((ok) => setTimeout(ok, 600)); await r.continue(); });
    await p.goto(`/check/combo?legs=${legsQuery(picks)}`);
    await expect(p.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
    await p.waitForTimeout(800);
    const legsH = () => p.getByTestId("combo-legs").evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const input = p.getByLabel("Add a bet by link or words");
    await input.fill("https://polymarket.com/event/not-a-real-market-xyz");
    await p.getByRole("button", { name: "Add", exact: true }).click();
    await expect(p.getByTestId("combo-note")).toContainText("find an open market", { timeout: 20_000 });
    await p.waitForTimeout(900);
    const held = await legsH();
    const idle = await cls(p);
    await p.waitForTimeout(1500);
    expect(await cls(p), "nothing moves by itself").toBe(idle);
    expect(await legsH(), "the room is still held with no input").toBe(held);
    await input.click();   // the tap that focuses the field (a person taps before typing)
    await input.press("End");
    await input.pressSequentially("x");   // the next keystroke
    await p.waitForTimeout(600);
    const released = await legsH();
    console.log(`T-wt3f refusal room at ${name}px: held ${held}px -> after a keystroke ${released}px; CLS ${(await cls(p)).toFixed(4)}`);
    expect(held - released, "the held room (about one leg) is given back").toBeGreaterThanOrEqual(60);
    expect(await cls(p), "giving it back on a keystroke is not a counted shift").toBeLessThan(0.02);
    await ctx.close();
  });
}

// T-wt3f 2: "(cautious)" is explained once, in plain words, in the Why details.
test("the Why details explain '(cautious)' once, in plain words", async ({ page }) => {
  const [a, b] = distinct(await rows(page), 2);
  await page.goto(`/check/combo?legs=${legsQuery([a!, b!])}`);
  await expect(page.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
  await page.getByTestId("combo-check-btn").click();
  await expect(page.getByTestId("combo-score")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("combo-why").locator("summary").click();
  const why = page.getByTestId("combo-why-cautious");
  await expect(why).toHaveText("Combos use each bet's cautious chance, a little below its card, because small errors multiply.");
  await expect(page.getByText("cautious chance, a little below")).toHaveCount(1);
});

// T-wt3f 3: pasting the EVENT link of a leg already in the combo is a duplicate, not a different market from that event.
test("an event link whose event already has a leg is refused as a duplicate (whichever of its markets is the leg)", async ({ page }) => {
  test.setTimeout(240_000);
  const all = (await (await page.request.get("/api/markets?limit=60&sort=edge")).json()).rows as (Row & { market: { slug: string } })[];
  const byEvent = new Map<string, typeof all>();
  for (const r of all) byEvent.set(r.market.event_id, [...(byEvent.get(r.market.event_id) ?? []), r]);
  const pair = [...byEvent.values()].find((l) => new Set(l.map((r) => r.market.id)).size >= 2);
  test.skip(!pair, "fixture has no event with two markets in the list");
  const two = [...new Map(pair!.map((r) => [r.market.id, r])).values()].slice(0, 2);
  for (const leg of two) {
    await page.goto("/check/combo");
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`/check/combo?legs=${leg.market.id}:${leg.side.side_index}`);
    await expect(page.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
    await page.getByLabel("Add a bet by link or words").fill(`https://polymarket.com/event/${leg.market.slug}`);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByTestId("combo-note")).toHaveText("That bet is already in your combo.", { timeout: 20_000 });
    await expect(page.getByTestId("combo-leg")).toHaveCount(1);
  }
});

// T-wt3f (review): a Polymarket US link names ONE market (/event/<aec-...> and /market/<aec-...> alike), so the sibling of a leg is a
// different bet and is added; only polymarket.com EVENT links are refused when their event already has a leg.
for (const [name, size] of SIZES) {
  test(`a Polymarket US link to a sibling market in the same event is added, not refused, at ${name}px`, async ({ browser }) => {
    test.setTimeout(240_000);
    for (const [have, want, kind] of [["7077573", "7077574", "market"], ["7077574", "7077573", "market"], ["7077573", "7077574", "event"]] as const) {
      const ctx = await browser.newContext({ viewport: size, baseURL: test.info().project.use.baseURL });
      const p = await ctx.newPage();
      await p.goto(`/check/combo?legs=${have}:0`);
      await expect(p.getByTestId("combo-leg")).toHaveCount(1, { timeout: 30_000 });
      await p.getByLabel("Add a bet by link or words").fill(`https://polymarket.us/${kind}/aec-cfb-${want}`);
      await p.getByRole("button", { name: "Add", exact: true }).click();
      await expect(p.getByTestId("combo-leg"), `${kind} link ${want} after ${have}`).toHaveCount(2, { timeout: 20_000 });
      await expect(p.getByTestId("combo-note")).not.toContainText("already in your combo");
      await ctx.close();
    }
  });
}

// T-wt3f (review): the refused add's room is given back on focus or tap in the input (user input), so a long-press Paste or an autofill,
// which fire no keystroke, move nothing that counts.
for (const [name, size] of SIZES) {
  test(`pasting without a keypress after a refusal shifts nothing (the tap in the input gives the room back) at ${name}px`, async ({ browser, page }) => {
    test.setTimeout(180_000);
    const picks = distinct(await rows(page), 2);
    const ctx = await browser.newContext({ viewport: size, baseURL: test.info().project.use.baseURL });
    const p = await ctx.newPage();
    await p.addInitScript(watchCls);
    await p.goto(`/check/combo?legs=${legsQuery(picks)}`);
    await expect(p.getByTestId("combo-leg")).toHaveCount(2, { timeout: 30_000 });
    await p.waitForTimeout(800);
    const input = p.getByLabel("Add a bet by link or words");
    await input.press("End"); await input.press("x");
    await input.fill("https://polymarket.com/event/not-a-real-market-xyz");
    await p.getByRole("button", { name: "Add", exact: true }).click();
    await expect(p.getByTestId("combo-note")).toContainText("find an open market", { timeout: 20_000 });
    await p.waitForTimeout(900);
    const before = await cls(p);
    await input.click();   // the tap that starts a long-press Paste
    await p.waitForTimeout(1200);   // the paste menu, then Paste: well past the 500 ms input window
    await p.keyboard.insertText("https://polymarket.com/event/another-one");   // no keydown at all
    await p.waitForTimeout(700);
    const delta = (await cls(p)) - before;
    console.log(`T-wt3f paste-without-keypress CLS at ${name}px: ${delta.toFixed(4)}`);
    expect(delta).toBeLessThan(0.001);   // nothing that counts moves
    await ctx.close();
  });
}
