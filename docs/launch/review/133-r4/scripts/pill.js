// F05 pill case at 1440: tour open over the filtered list; is the pill reachable before/after Skip tour?
const L = require("./lib");
(async () => {
  const { browser, page, log } = await L.start(390, 844, "r126-pill");
  const email = `r126-pill-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(2500);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
  const me = await (await page.request.get("/api/me")).json();
  await page.request.patch(`/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { comp_tier: "premium" } });
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /^NFL/ }).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForURL(/fav=1/, { timeout: 60000 }); await page.waitForLoadState("networkidle");
  await page.goto("/bets?fav=1&t=sports.nfl%2Cpolitics.elections"); 
  const pill = page.getByRole("link", { name: "Remove filter: Your topics" });
  await pill.waitFor({ timeout: 30000 }); await page.waitForLoadState("networkidle");
  const probe = async (tag) => {
    const r = await pill.evaluate((el) => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { pill: [Math.round(r.top), Math.round(r.bottom)], scrollY: Math.round(scrollY), top: t ? (t.closest("a")?.getAttribute("aria-label") ?? t.tagName + "." + String(t.className).slice(0, 40)) : "null(off-screen)", tour: !!document.querySelector('[aria-labelledby="tour-h"]') }; });
    console.log(tag, JSON.stringify(r));
  };
  for (const ms of [0, 500, 1500, 3000]) { await page.waitForTimeout(ms ? ms - (ms === 500 ? 0 : 0) : 0); await probe(`t+${ms}`); }
  await page.screenshot({ path: `${process.env.OUT}/390-pill-tour-open.png` });
  const skip = page.getByRole("button", { name: "Skip tour" });
  if (await skip.isVisible()) { await skip.click(); await page.waitForTimeout(500); await probe("after Skip tour");
    await pill.click(); await page.waitForTimeout(1500); console.log("after pill click url " + page.url().replace(L.BASE, "") + " pill count " + (await pill.count())); }
  await page.screenshot({ path: `${process.env.OUT}/390-pill-after-skip.png` });
  console.log(log.join("\n")); await browser.close();
})();
