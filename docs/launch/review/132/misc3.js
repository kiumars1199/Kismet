const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const P = `${w}-misc`;
(async () => {
  const { browser, page, log } = await L.start(w, h, "misc");
  // auth email step (signup) + login magic link
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1500);
  const email = `p132-misc-${w}-${Date.now()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 132");
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 }); await page.waitForTimeout(500);
  const b = page.getByRole("button", { name: "Use a different email" }); console.log(`[${w}] signup email step: different-email ${JSON.stringify(await b.boundingBox())} count=${await b.count()}`);
  await L.audit(page, `${P} check-email`); await L.shot(page, P, "check-email");
  await b.click(); await page.waitForTimeout(500); console.log(`[${w}] after click: email field visible=${await page.getByLabel("Email", { exact: true }).isVisible()}`);
  // finish signup, then UTC zone
  await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 }); await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(2500);
  const me = await (await page.request.get("/api/me")).json();
  const pr = await page.request.patch(`/e2e-mock/supabase/rest/v1/profiles?id=eq.${me.user.id}`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service", "content-type": "application/json" }, data: { timezone: "UTC" } });
  console.log(`[${w}] patch profile tz UTC: ${pr.status()}`);
  await page.goto("/settings", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  const sel = async () => page.evaluate(() => [...document.querySelectorAll("select")].map((s) => `${s.value}=>"${s.options[s.selectedIndex]?.text}" (${s.options.length})`));
  console.log(`[${w}] settings tz after patch: ${JSON.stringify(await sel())}`);
  const tzSel = page.locator("select").filter({ has: page.locator('option[value="Europe/London"]') });
  await tzSel.selectOption("Europe/London"); await page.waitForTimeout(1500);
  await tzSel.selectOption("UTC"); await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  console.log(`[${w}] settings tz after choosing UTC + reload: ${JSON.stringify(await sel())} profile=${(await (await page.request.get("/api/me")).json()).profile?.timezone}`);
  await L.shot(page, P, "settings-utc"); await L.audit(page, `${P} settings`);
  // sort headers
  await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  console.log(`[${w}] sort headers: ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("thead button")].map((x) => { const r = x.getBoundingClientRect(); return `${x.textContent.trim().slice(0, 12)} ${Math.round(r.width)}x${Math.round(r.height)}`; })))} thead h=${await page.evaluate(() => Math.round(document.querySelector("thead")?.getBoundingClientRect().height || 0))}`);
  console.log("--- LOG\n" + log.join("\n")); await browser.close();
})();
