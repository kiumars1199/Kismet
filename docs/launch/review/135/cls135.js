// /markets CLS with N saved topics (6 | all), per tier. args: <WxH> <n|all> <tier>
const L = require("./lib");
const [w, h] = process.argv[2].split("x").map(Number); const N = process.argv[3]; const tier = process.argv[4] || "free"; const P = `${w}-${N}-${tier}`;
(async () => {
  const { browser, page, log } = await L.start(w, h, `cls-${N}-${tier}`);
  try {
    const email = `r135-cls-${w}-${N}-${tier}-${Date.now()}@example.com`;
    await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(2000);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 135");
    await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
    await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 }); await page.waitForTimeout(1500);
    if (tier !== "free") {
      const me = await (await page.request.get("/api/me")).json();
      await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: tier } });
      await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1500);
    }
    const topics = page.locator("button[aria-pressed][aria-describedby]"); await topics.first().waitFor({ timeout: 30000 });
    const total = await topics.count(); const want = N === "all" ? total : +N;
    for (let i = 0; i < want; i++) { const b = topics.nth(i); for (let k = 0; k < 20 && (await b.getAttribute("aria-pressed")) !== "true"; k++) { await b.click(); await page.waitForTimeout(400); } await page.waitForTimeout(250); }
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(3000);
    const me = await (await page.request.get("/api/me")).json();
    const fav = me.profile?.favorite_topics ?? me.favorite_topics ?? [];
    console.log(`[${P}] tier=${me.tier} onboarding topics=${total} wanted=${want} saved=${fav.length}`);
    for (const u of ["/markets", "/markets?q=texans"]) for (let t = 0; t < 2; t++) {
      await page.goto(u, { waitUntil: "networkidle" }); await page.waitForTimeout(2500);
      const a = await L.audit(page, `${P} ${u} try${t}`);
      const row = await page.evaluate(() => { const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); if (!g) return null; return { h: Math.round(g.getBoundingClientRect().height), chips: g.querySelectorAll("button").length, starred: g.querySelectorAll('svg[aria-label="Favorite topic"]').length }; });
      const pers = await page.evaluate(() => (document.body.innerText.match(/[^\n]{0,40}(recommended for you|your picks|based on your (bets|positions|history)|picked for you)[^\n]{0,40}/gi) || []));
      console.log(`[${P}] ${u} try${t} CLS=${a.cls} ${a.cls > 0.02 ? "FAIL>0.02" : "ok"} row=${JSON.stringify(row)} disc=${a.disc}/${a.footDisc} cents=${a.cents.length} personalized=${JSON.stringify(pers)}`);
      if (t === 0) await L.shot(page, P, u.replace(/[^a-z]+/g, "_"));
    }
  } catch (e) { console.log(`[${P}] ERR ${e.message.split("\n")[0]}`); }
  console.log(log.filter((l) => !/429|preload/.test(l)).join("\n")); await browser.close();
})();
