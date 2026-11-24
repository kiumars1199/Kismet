// quick taps in settings then leave at once. args: <WxH> <tier> <how: link|goto>
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const tier = process.argv[3]; const how = process.argv[4];
(async () => {
  const { browser, page, log } = await L.start(w, h, "nav");
  const P = `[${w} ${tier} ${how}]`;
  try {
    await H.signup(page, `nav-${tier}-${w}`, { topics: ["NFL"], tier: tier === "free" ? undefined : tier });
    const me = await (await page.request.get("/api/me")).json();
    const server = async () => (await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json())[0].favorite_topics.slice().sort();
    await page.goto("/settings", { waitUntil: "networkidle" }); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor(); await page.waitForTimeout(1200);
    const picker = page.getByTestId("topics-picker"); const tiles = picker.locator("button");
    for (const i of [2, 4, 5]) { const t = tiles.nth(i); await t.evaluate((e) => e.scrollIntoView({ block: "center" })); const b = await t.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    const ui = await picker.locator('button[aria-pressed="true"]').allInnerTexts();
    if (how === "link") { const a = page.locator('a[href="/markets"]:visible').first(); await a.evaluate((e) => e.scrollIntoView({ block: "center" })); await a.click(); await page.waitForURL(/\/markets/); }
    else await page.goto("/markets", { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const chips = await page.evaluate(() => { const g = [...document.querySelectorAll('[role="group"][aria-label="Quick filters"]')].find((x) => /Save this view/.test(x.textContent)); return g ? [...g.querySelectorAll("button")].filter((b) => b.querySelector("svg") || /★/.test(b.textContent)).map((b) => b.textContent.trim()) : null; });
    const srv = await server();
    console.log(`${P} UI at leave=${JSON.stringify(ui.map((x) => x.split("\n")[0]))} -> /markets chips=${JSON.stringify(chips)} server=${JSON.stringify(srv)}`);
    await page.goto("/", { waitUntil: "networkidle" }); const u = new URL(page.url());
    console.log(`${P} Home -> ${u.pathname} t=${JSON.stringify((u.searchParams.get("t") || "").split(",").filter(Boolean).sort())} matchesServer=${JSON.stringify((u.searchParams.get("t") || "").split(",").filter(Boolean).sort()) === JSON.stringify(srv)}`);
  } catch (e) { console.log(`${P} ERR ${e.message.split("\n")[0]}`); }
  console.log(log.filter((l) => !/429|preload/.test(l)).join("\n")); await browser.close();
})();
