// #106 (e): display "optional" vs "swap". usage: WT=<worktree> node rvfont.mjs <port> <label> <out> [plan]
// Per page and width: cold cache (CDP cache off), fonts at normal speed / +300 ms / +1500 ms / throttled "slow 4G";
// records the platform font actually used by the h1 and a body paragraph (CDP CSS.getPlatformFontsForNode), CLS and shifts,
// then a client-side navigation (same document) and a reload (warm cache).
import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const [port, label, out, plan] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const fs = await import("fs"); fs.mkdirSync(out, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(`${out}/font-${label}.log`, s + "\n"); };
const svc = { authorization: "Bearer e2e-service", apikey: "e2e-anon", "content-type": "application/json" };
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const init = () => { window.__cls = 0; window.__s = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; if (e.value > 0.001) window.__s.push(`${e.value.toFixed(4)}@${Math.round(e.startTime)} fonts=${document.fonts.status} ` + (e.sources || []).slice(0, 3).map((s) => `${s.node?.nodeName}"${(s.node?.textContent ?? "").slice(0, 30).replace(/\s+/g, " ")}" y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`).join(" | ")); } }).observe({ type: "layout-shift", buffered: true }); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function used(page, cdp, sel) {
  try {
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
    if (!nodeId) return null;
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return fonts.map((f) => `${f.familyName}${f.isCustomFont ? "*" : ""}:${f.glyphCount}`).join(",");
  } catch (e) { return "err " + e.message.slice(0, 40); }
}
async function signIn(page, email) {
  await page.goto(base + "/login");
  for (let i = 0; i < 30; i++) { try { await page.getByRole("tab", { name: "Email link" }).click({ timeout: 2000 }); await page.getByRole("button", { name: "Email me a sign-in link" }).waitFor({ timeout: 2000 }); break; } catch {} }
  await page.getByLabel("Email", { exact: true }).fill(email); await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  const { url } = await (await fetch(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url); await page.waitForURL(/onboarding/, { timeout: 90000 });
  const me = await (await page.request.get(base + "/api/me")).json();
  if (plan && plan !== "free") await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${me.user.id}`, { method: "PATCH", headers: svc, body: JSON.stringify({ comp_tier: plan, comp_expires_at: null }) });
  await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 60000 });
  await page.waitForURL((u) => u.pathname !== "/onboarding", { timeout: 60000 }); await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Skip tour" }); await skip.waitFor({ timeout: 8000 }).catch(() => {}); if (await skip.isVisible().catch(() => false)) await skip.click();
}
const PAGES = plan ? ["/", "/bets?fav=0"] : ["/", "/pricing", "/m/7080508", "/track-record"];
const MODES = [["normal", 0], ["font+300ms", 300], ["font+1500ms", 1500], ["slow4g", -1]];
for (const w of [390, 1440]) {
  const mobile = w === 390;
  const ctx = await b.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, hasTouch: mobile, isMobile: mobile, extraHTTPHeaders: { "x-e2e-device": `rvfont-${label}-${w}-${Date.now()}` } });
  await ctx.addInitScript(init);
  // ARIALFB=1: emulate a device that HAS Arial (iOS, macOS, Windows): next/font's fallback faces are local("Arial") with metric overrides,
  // which this Linux box can't resolve (it falls through to system-ui). Same overrides, on Liberation Sans (Arial-metric clone).
  if (process.env.ARIALFB) await ctx.addInitScript(() => { const css = `@font-face{font-family:"Inter Fallback";src:local("Liberation Sans");font-weight:100 599;ascent-override:90.44%;descent-override:22.52%;line-gap-override:0%;size-adjust:107.12%}@font-face{font-family:"Inter Fallback";src:local("Liberation Sans Bold");font-weight:600 900;ascent-override:90.44%;descent-override:22.52%;line-gap-override:0%;size-adjust:107.12%}@font-face{font-family:"Space Grotesk Fallback";src:local("Liberation Sans");font-weight:100 599;ascent-override:89.71%;descent-override:26.62%;line-gap-override:0%;size-adjust:109.69%}@font-face{font-family:"Space Grotesk Fallback";src:local("Liberation Sans Bold");font-weight:600 900;ascent-override:89.71%;descent-override:26.62%;line-gap-override:0%;size-adjust:109.69%}`; const add = () => { const st = document.createElement("style"); st.textContent = css; (document.head || document.documentElement).prepend(st); }; if (document.documentElement) add(); else document.addEventListener("readystatechange", add, { once: true }); });
  if (plan) { const p0 = await ctx.newPage(); await signIn(p0, `rvfont-${label}-${plan}-${w}-${Date.now()}@example.com`); await p0.close(); }
  for (const path of PAGES) for (const [mode, delay] of MODES) {
    const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true }); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    if (delay > 0) await page.route(/\.woff2(\?|$)/, async (r) => { await new Promise((x) => setTimeout(x, delay)); await r.continue(); });
    if (delay < 0) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    const t0 = Date.now();
    await page.goto(base + path, { waitUntil: "load", timeout: 180000 }); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(2500);
    const skip = page.getByRole("button", { name: "Skip tour" }); if (await skip.isVisible().catch(() => false)) await skip.click();
    const st = await page.evaluate((DISC) => ({ cls: +window.__cls.toFixed(4), s: window.__s, fonts: document.fonts.status, faces: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i).join(","), h1: document.querySelector("h1")?.innerText.slice(0, 50), h1h: Math.round(document.querySelector("h1")?.getBoundingClientRect().height ?? 0), disc: document.querySelector("footer")?.innerText.includes(DISC), cents: /¢|\d\s?cents?\b/i.test(document.body.innerText), preload: [...document.querySelectorAll('link[rel=preload][as=font]')].length }), DISC);
    const h1f = await used(page, cdp, "h1"), pf = await used(page, cdp, "main p");
    log(`${label} ${w} ${path} ${mode} load=${Date.now() - t0}ms preload=${st.preload} h1=${JSON.stringify(st.h1)} h1h=${st.h1h} h1font=[${h1f}] pfont=[${pf}] loadedFaces=[${st.faces}] cls=${st.cls} disc=${st.disc} cents=${st.cents} shifts=${JSON.stringify(st.s)}`);
    const tag = `${label}-${w}-${path.replace(/[^a-z0-9]+/gi, "_")}-${mode}`;
    if (mode === "normal" || mode === "font+1500ms") await page.screenshot({ path: `${out}/font-${tag}.png` });
    if (mode === "font+1500ms" || mode === "slow4g") {
      // same document: client-side navigation after the fonts have arrived
      await page.waitForTimeout(1500);
      const link = page.locator('a[href="/pricing"], a[href="/track-record"], a[href="/about"]').first();
      if (await link.count()) {
        await page.evaluate(() => { window.__cls = 0; window.__s = []; });
        await link.click().catch(() => {}); await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(2000);
        const h1f2 = await used(page, cdp, "h1"); const pf2 = await used(page, cdp, "main p");
        log(`${label} ${w} ${path} ${mode} -> client nav ${new URL(page.url()).pathname}: h1font=[${h1f2}] pfont=[${pf2}] cls=${await page.evaluate(() => window.__cls.toFixed(4))}`);
      }
      // reload with the cache on (the second visit)
      await page.unroute(/\.woff2(\?|$)/).catch(() => {}); await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await page.goto(base + path, { waitUntil: "load" }); await page.waitForTimeout(2000);
      log(`${label} ${w} ${path} ${mode} -> reload warm: h1font=[${await used(page, cdp, "h1")}] pfont=[${await used(page, cdp, "main p")}] cls=${await page.evaluate(() => window.__cls.toFixed(4))}`);
    }
    await page.close();
  }
  await ctx.close();
}
await b.close();
