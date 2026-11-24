// /markets CLS repro + tap areas at 1440 (fresh Free account)
const L = require("./lib");
(async () => {
  const [w, h] = process.argv[2].split("x").map(Number);
  const { browser, page, log } = await L.start(w, h, "r3-mk");
  const email = `r3-mk-${w}-${Date.now()}@example.com`;
  await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(2500);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator("input").and(page.getByLabel("Password", { exact: true })).fill("walk password 3");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  await page.goto(await L.inbox(page, email)); await page.waitForURL(/\/onboarding/, { timeout: 60000 }); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /^NFL/ }).click(); if (process.env.THREE) { await page.getByRole("button", { name: /^Soccer/ }).click(); await page.getByRole("button", { name: /^College basketball/ }).click(); } await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForTimeout(4000);
  for (const u of (process.env.THREE ? ["/settings", "/markets?q=texans", "/settings", "/markets?q=texans", "/settings", "/markets?q=texans", "/settings", "/markets?q=texans", "/markets?q=texans", "/markets?q=texans"] : ["/markets?q=texans", "/markets?q=texans", "/markets", "/markets?q=texans"])) {
    await page.goto(u, { waitUntil: process.env.NI ? "networkidle" : "load" }).catch(() => {}); await page.waitForTimeout(process.env.NI ? 1800 : 4000);
    const r = await page.evaluate(() => ({ cls: +window.__cls.toFixed(4), sh: window.__shifts.filter((s) => s.v > 0.001).map((s) => ({ v: s.v, t: s.t, src: s.src.slice(0, 2) })) }));
    console.log(`[${w}] ${u} CLS ${r.cls} ${JSON.stringify(r.sh)}`);
  }
  await L.shot(page, `${w}-mk`, "markets-search");
  const taps = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('main input[type=checkbox], main button[aria-label="Choose columns"], main a[aria-label^="Remove from search"], main button')) {
      const r = el.getBoundingClientRect(); if (!r.width || r.top > innerHeight) continue;
      const lab = el.closest("label"); const lr = lab?.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.push(`${(el.getAttribute("aria-label") || el.textContent || el.type).trim().slice(0, 25)} ${Math.round(r.width)}x${Math.round(r.height)}${lr ? ` label ${Math.round(lr.width)}x${Math.round(lr.height)}` : ""}`);
    }
    return out.slice(0, 12);
  });
  console.log(`[${w}] small in main: ${JSON.stringify(taps)}`);
  console.log(log.join("\n")); await browser.close();
})();
