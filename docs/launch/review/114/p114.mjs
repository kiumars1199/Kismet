// #114: /m rendered in a browser, base vs PR, 390 and 1440, signed out (and signed in when SIGNIN=1 on a dev server with mocks)
import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const [ports, out, ids] = [process.argv[2].split(","), process.argv[3], process.argv[4].split(",")];
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const init = () => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); };
async function signIn(page, base, email) {
  await page.goto(base + "/login");
  for (let i = 0; i < 30; i++) { try { await page.getByRole("tab", { name: "Email link" }).click({ timeout: 2000 }); await page.getByRole("button", { name: "Email me a sign-in link" }).waitFor({ timeout: 2000 }); break; } catch {} }
  await page.getByLabel("Email", { exact: true }).fill(email); await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click(); await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  const { url } = await (await fetch(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url).catch(() => {}); await page.waitForURL((u) => !/login|auth|callback/.test(u.pathname), { timeout: 90000 });
  if (/onboarding/.test(page.url())) { await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 60000 }); await page.waitForURL((u) => u.pathname !== "/onboarding", { timeout: 60000 }); }
}
for (const port of ports) for (const [w, h] of [[390, 844], [1440, 900]]) {
  const base = `http://localhost:${port}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); await ctx.addInitScript(init);
  const p = await ctx.newPage();
  const who = process.env.SIGNIN ? "free" : "signed-out";
  if (process.env.SIGNIN) await signIn(p, base, `p114-${port}-${w}-${Date.now()}@example.com`);
  for (const id of ids) {
    const r = await p.goto(`${base}/m/${id}`); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200);
    const f = await p.evaluate((D) => ({ title: document.title, h1: document.querySelector("h1")?.innerText, disc: (document.querySelector("footer")?.innerText ?? "").includes(D), cents: /\d\s?¢|\bcents?\b/i.test(document.body.innerText), cls: +window.__cls.toFixed(4), hscroll: document.documentElement.scrollWidth > innerWidth, og: document.querySelector('meta[property="og:title"]')?.content, desc: document.querySelector('meta[name="description"]')?.content?.slice(0, 80), main: document.querySelector("main")?.innerText.replace(/\s+/g, " ").slice(0, 160) }), DISC);
    console.log(`${port} ${who} ${w} /m/${id} ${r.status()} ${JSON.stringify(f)}`);
    if (id === ids[0]) await p.screenshot({ path: `${out}/m-${port}-${who}-${w}-${id}.png` });
  }
  await ctx.close();
}
await b.close();
