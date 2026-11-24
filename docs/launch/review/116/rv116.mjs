// usage: TAG=base|pr node rv116.mjs <webdir> <outdir>  (server on :3755, t116 data)
import { createRequire } from "module"; import fs from "fs"; import crypto from "crypto";
const [webdir, out] = process.argv.slice(2); const tag = process.env.TAG;
const require = createRequire(`${webdir}/package.json`); const { chromium } = require("@playwright/test");
const base = "http://localhost:3755", DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const ids = fs.readFileSync("/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/t116/ids.txt", "utf8").trim().split("\n");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const who of (process.env.WHOS || "out,free").split(",")) for (const w of [390, 1440]) {
  const touch = w < 800;
  const ctx = await browser.newContext({ viewport: { width: w, height: touch ? 844 : 900 }, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  if (who === "free") {
    const email = `rv116-${w}-${Date.now()}@example.com`;
    await page.goto(base + "/login", { timeout: 180000 });
    for (let i = 0; i < 30; i++) { await page.getByRole("tab", { name: "Email link" }).click(); if (await page.getByRole("button", { name: "Email me a sign-in link" }).isVisible()) break; await page.waitForTimeout(1000); }
    await page.locator("input[type=email]").fill(email); await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 60000 });
    const { url } = await (await page.request.get(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
    await page.goto(url, { timeout: 180000 }); await page.waitForURL(/onboarding/, { timeout: 120000 });
    await page.getByRole("button", { name: "Skip setup" }).click(); await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/bets", { timeout: 120000 });
  }
  for (const p of ["/", `/m/${ids[0]}`, `/m/${ids[24]}`]) {
    await page.goto(base + p, { waitUntil: "load", timeout: 180000 }); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(1500);
    const f = await page.evaluate((DISC) => ({ url: location.pathname, h1: document.querySelector("h1")?.innerText ?? null, cls: +window.__cls.toFixed(4), hscroll: document.documentElement.scrollWidth > innerWidth, disc: (document.querySelector("footer")?.innerText ?? "").includes(DISC), cents: /¢|\d\s?cents?\b/i.test(document.body.innerText), text: document.querySelector("main")?.innerText ?? document.body.innerText }), DISC);
    const norm = f.text.replace(/\d+\s?(s|sec|min|minutes?|hours?|h|m) ago/gi, "#ago").replace(/\b\d{1,2}:\d{2}\b/g, "#t");
    fs.writeFileSync(`${out}/${tag}-${who}-${w}-${p === "/" ? "home" : p.split("/").pop()}.txt`, norm);
    console.log(tag, who, w, p, JSON.stringify({ ...f, text: undefined, sha: crypto.createHash("sha1").update(norm).digest("hex").slice(0, 10), errs }));
    await page.screenshot({ path: `${out}/${tag}-${who}-${w}-${p === "/" ? "home" : p.split("/").pop()}.png` });
  }
  await ctx.close();
}
await browser.close();
