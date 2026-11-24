const L = require("./lib");
(async () => {
  const [w, h] = process.argv[2].split("x").map(Number);
  const { browser, page, log } = await L.start(w, h, "wt2r2-cls");
  const email = `wt2r2-cls-${w}-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(3000);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 2");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
  const nfl = page.getByRole("button", { name: /^NFL/ }); await nfl.waitFor(); await page.waitForTimeout(1500); await nfl.click();
  await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(4000);
  for (const r of ["/alerts", "/dashboards", "/alerts"]) {
    await page.goto(r, { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
    await L.shot(page, `${w}-cls`, r.slice(1));
    await L.audit(page, r);
  }
  for (const r of ["/markets?q=texans"]) { await page.goto(r, { waitUntil: "networkidle" }); await page.waitForTimeout(1000); await L.shot(page, `${w}-sweep2`, "markets-search"); }
  console.log(log.join("\n")); await browser.close();
})();
