// r3: onboarding quick taps then finish at once. args: <WxH> <how: skip|show> <tier>
const L = require("./lib");
const [w, h] = process.argv[2].split("x").map(Number); const how = process.argv[3]; const tier = process.argv[4] || "free";
(async () => {
  const { browser, ctx, page, log } = await L.start(w, h, "onb");
  const P = `[${w} ${how} ${tier} d${process.env.PATCH_DELAY || 0}]`;
  try {
    const email = `p133-onb-${how}-${tier}-${w}-${Date.now()}@example.com`;
    await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1500);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 133");
    await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
    await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
    const me = await (await page.request.get("/api/me")).json();
    if (tier !== "free") { await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier } }); await page.reload({ waitUntil: "load" }); }
    const server = async () => (await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json())[0].favorite_topics.slice().sort();
    await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(1000);
    const tiles = page.getByTestId("topics-picker").locator("button");
    for (const i of [0, 2, 4]) { const t = tiles.nth(i); await t.evaluate((e) => e.scrollIntoView({ block: "center" })); const b = await t.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    const ui = (await page.getByTestId("topics-picker").locator('button[aria-pressed="true"]').allInnerTexts()).map((x) => x.split("\n")[0]);
    if (how === "skip") await page.getByRole("button", { name: "Skip setup" }).click();
    else { const nx = page.getByRole("button", { name: /^(Next|Show my best bets)$/ }); for (let i = 0; i < 3; i++) { await nx.click(); if (i < 2) await page.waitForTimeout(+(process.env.STEP_MS || 0)); } }
    await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"), { timeout: 20000 }); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
    const u = new URL(page.url()); const t = (u.searchParams.get("t") || "").split(",").filter(Boolean).sort();
    const srv = await server(); await page.request.get("/api/me");
    const ck = (decodeURIComponent(((await ctx.cookies()).find((c) => c.name === "me_topics") || {}).value || "-").split("|")[1] || "").replace("on:", "").split(",").filter(Boolean).sort();
    const h1 = await page.locator("h1").first().innerText().catch(() => "-");
    console.log(`${P} UI at finish=${JSON.stringify(ui)} landed=${u.pathname}${u.search.slice(0, 90)} urlTopics=${JSON.stringify(t)} server=${JSON.stringify(srv)} cookie=${JSON.stringify(ck)} h1="${h1}" urlMatchesServer=${JSON.stringify(t) === JSON.stringify(srv)}`);
    await page.goto("/", { waitUntil: "networkidle" }); const u2 = new URL(page.url());
    console.log(`${P} Home again -> t=${JSON.stringify((u2.searchParams.get("t") || "").split(",").filter(Boolean).sort())}`);
  } catch (e) { console.log(`${P} ERR ${e.message.split("\n")[0]}`); }
  console.log(log.filter((l) => !/429|preload/.test(l)).join("\n")); await browser.close();
})();
