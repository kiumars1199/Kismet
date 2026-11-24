const L = require("./lib");
const [w, h] = process.argv[2].split("x").map(Number); const mode = process.argv[3] || "fast";
const NAMES = ["NFL", "Soccer", "College basketball", "NBA", "Baseball", "Hockey"];
(async () => {
  const { browser, page, log } = await L.start(w, h, "race");
  const email = `p132-race-${w}-${mode}-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1500);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 132");
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email), { waitUntil: "commit" }); await page.waitForURL(/\/onboarding/, { timeout: 60000 });
  const tile = (n) => page.getByTestId("topics-picker").getByRole("button", { name: new RegExp("^" + n + "\\b") }).first();
  await tile("NFL").waitFor(); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor();
  const me = await (await page.request.get("/api/me")).json();
  const server = async () => (await (await page.request.get(`/e2e-mock/supabase/rest/v1/profiles?user_id=eq.${me.user.id}&select=favorite_topics`, { headers: { authorization: "Bearer e2e-service", apikey: "e2e-service" } })).json());
  const pressed = async () => page.getByTestId("topics-picker").locator('button[aria-pressed="true"]').allInnerTexts().then((a) => a.map((x) => x.split("\n")[0]));
  const clickAll = async (names) => { for (const n of names) { const t = tile(n); await t.scrollIntoViewIfNeeded(); const b = await t.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); if (mode === "slow") await page.waitForTimeout(600); } };
  // onboarding
  await clickAll(NAMES.slice(0, 4));
  const ui0 = await pressed(); await page.waitForTimeout(3000);
  console.log(`[${w} ${mode}] onboarding clicked 4: UI right after=${JSON.stringify(ui0)} UI +3s=${JSON.stringify(await pressed())} server=${JSON.stringify(await server())}`);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  console.log(`[${w} ${mode}] onboarding after reload: ${JSON.stringify(await pressed())}`);
  await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(2500);
  // settings
  await page.goto("/settings", { waitUntil: "load" }); await tile("Hockey").waitFor(); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor();
  await page.waitForTimeout(1500); const before = await pressed();
  await clickAll(["Baseball", "Hockey", "NFL"]);   // add 2, remove 1
  await page.waitForTimeout(3000);
  console.log(`[${w} ${mode}] settings before=${JSON.stringify(before)} clicked +MLB +NHL -NFL: UI=${JSON.stringify(await pressed())} server=${JSON.stringify(await server())}`);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  console.log(`[${w} ${mode}] settings after reload: ${JSON.stringify(await pressed())}`);
  // settings immediately on load (before ready?)
  await page.goto("/settings", { waitUntil: "commit" });
  await tile("Soccer").waitFor(); await page.locator('[data-testid="topics-picker"][aria-busy="false"]').waitFor();
  await clickAll(["Soccer", "College basketball"]);
  await page.waitForTimeout(3000); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  console.log(`[${w} ${mode}] settings right-after-hydration -Soccer -College basketball, after reload: ${JSON.stringify(await pressed())} server=${JSON.stringify(await server())}`);
  console.log("--- LOG\n" + log.join("\n")); await browser.close();
})();
