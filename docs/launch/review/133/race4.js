// T-wt2j review: quick taps with/without 300 ms PATCH delay, error mid-queue, cookie, Home/markets, CLS.
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const delay = +(process.argv[3] || 0); const tier = process.argv[4] || "free";
const P = `${w}-${tier}-d${delay}`; const SV = { authorization: "Bearer e2e-service", apikey: "e2e-service" };
(async () => {
  const { browser, page, log, ctx } = await L.start(w, h, `r4-${tier}`);
  const out = (s) => console.log(`[${P}] ${s}`);
  try {
    const email = `p133-${tier}-${w}-${delay}-${Date.now()}@example.com`;
    await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1500);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 133");
    await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
    let fail = 0; const seen = [];
    await page.route("**/api/data/profile", async (r) => {
      if (r.request().method() === "PATCH") {
        seen.push((r.request().postDataJSON() || {}).favorite_topics);
        if (delay) await new Promise((x) => setTimeout(x, delay));
        if (fail > 0) { fail--; return r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' }); }
      }
      return r.continue();
    });
    await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
    const me = await (await page.request.get("/api/me")).json();
    if (tier !== "free") { await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { ...SV, "content-type": "application/json" }, data: { comp_tier: tier } }); await page.reload({ waitUntil: "load" }); }
    const server = async () => ((await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: SV })).json())[0]?.favorite_topics || []).slice().sort();
    const cookie = async () => decodeURIComponent((await ctx.cookies()).find((c) => c.name === "me_topics")?.value || "").split(":")[1]?.split(",").filter(Boolean).sort() || [];
    const picker = page.getByTestId("topics-picker"); const tiles = picker.locator("button");
    const ids = async () => picker.locator('button[aria-pressed="true"]').allInnerTexts().then((a) => a.map((x) => x.split("\n")[0]).sort());
    const status = async () => (await picker.locator("p").first().innerText());
    const tap = async (idx) => { const bs = []; for (const i of idx) { const t = tiles.nth(i); await t.scrollIntoViewIfNeeded(); bs.push(await t.boundingBox()); } for (const b of bs) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
    const names = async (idx) => { const a = (await tiles.allInnerTexts()).map((x) => x.split("\n")[0]); return idx.map((i) => a[i]); };
    // B: taps right when the tiles enable (may be before the account store is ready)
    await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor();
    await tap([0, 1, 2]); const immediate = await ids();
    await page.waitForTimeout(2500 + delay * 4);
    out(`onboarding taps at enable: [${(await names([0, 1, 2])).join(", ")}] UI at once=${JSON.stringify(immediate)} UI settled=${JSON.stringify(await ids())} server=${JSON.stringify(await server())} cookie=${JSON.stringify(await cookie())} status="${await status()}"`);
    // A: settled, toggle 1 off, add 3,4
    await tap([1, 3, 4]); const im2 = await ids(); await page.waitForTimeout(2500 + delay * 4);
    out(`onboarding settled -#1 +#3 +#4: UI at once=${JSON.stringify(im2)} settled=${JSON.stringify(await ids())} server=${JSON.stringify(await server())} cookie=${JSON.stringify(await cookie())}`);
    await L.audit(page, `${P} onboarding`); await L.shot(page, P, "onboarding");
    await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(3000);
    // settings
    await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(1500);
    await L.audit(page, `${P} settings-load`);
    await tap([5, 6, 0]); const im3 = await ids(); await page.waitForTimeout(2500 + delay * 4);
    out(`settings +#5 +#6 -#0: UI at once=${JSON.stringify(im3)} settled=${JSON.stringify(await ids())} server=${JSON.stringify(await server())} cookie=${JSON.stringify(await cookie())}`);
    // D: error mid-queue: first PATCH 500, a second tap queued behind it
    const pre = await server(); fail = 1;
    await tap([7, 8]); const im4 = await ids(); await page.waitForTimeout(400 + delay * 3);
    out(`ERROR first PATCH, taps +#7 +#8: UI at once=${JSON.stringify(im4)} after=${JSON.stringify(await ids())} status="${await status()}" server=${JSON.stringify(await server())} (before ${JSON.stringify(pre)}) cookie=${JSON.stringify(await cookie())}`);
    await L.shot(page, P, "settings-error");
    await tap([9]); await page.waitForTimeout(2000 + delay * 3);
    out(`after error, tap +#9: UI=${JSON.stringify(await ids())} status="${await status()}" server=${JSON.stringify(await server())} cookie=${JSON.stringify(await cookie())}`);
    await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    out(`settings after reload UI=${JSON.stringify(await ids())} favLine="${(await page.locator("text=Favorites:").first().innerText().catch(() => "-"))}"`);
    out(`PATCH bodies seen: ${JSON.stringify(seen)}`);
    await page.unroute("**/api/data/profile");
    // E: Home and /markets open with the saved topics
    const fin = await server();
    await page.goto("/", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    const u = new URL(page.url()); out(`Home -> ${u.pathname}${u.search} t=${JSON.stringify((u.searchParams.get("t") || "").split(",").filter(Boolean).sort())} matches=${JSON.stringify((u.searchParams.get("t") || "").split(",").filter(Boolean).sort()) === JSON.stringify(fin)}`);
    await L.audit(page, `${P} home`);
    await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    const chips = await page.evaluate(() => { const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); return g ? [...g.querySelectorAll("button")].filter((b) => b.querySelector("svg") || /★/.test(b.textContent)).map((b) => b.textContent.trim()) : null; });
    out(`/markets favorite chips: ${JSON.stringify(chips)}`); await L.audit(page, `${P} markets`);
  } catch (e) { out("ERR " + e.message.split("\n")[0]); await L.shot(page, P, "err"); }
  console.log(log.filter((l) => !/429|preload/.test(l)).join("\n")); await browser.close();
})();
