// WT2 final: #418 hunt. Fresh browser context per load. args <WxH> <N> <tag>. env BASE. Prints every hydration-ish console error/pageerror in full.
const L = require("./lib"); const H = require("./h132"); const { chromium } = require("playwright");
const [w, h] = process.argv[2].split("x").map(Number); const N = +process.argv[3]; const tag = process.argv[4];
(async () => { const { browser, ctx, page } = await L.start(w, h, "h418c-" + tag); const hits = []; const evs = [];
  await H.signup(page, `h418c-${tag}`, { topics: ["NFL", "NBA"] }); const state = await ctx.storageState();
  const one = async (route, st) => { const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, baseURL: process.env.BASE, ...(st ? { storageState: st } : {}) }); const p = await c.newPage(); await p.addInitScript(() => { const t0 = performance.now(); const T = () => Math.round(performance.now() - t0); window.__ev = [];
      window.addEventListener("error", (e) => window.__ev.push(`${T()} ERR ${/418/.test(String(e.message)) ? "418" : String(e.message).slice(0, 40)}`));
      new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData" && m.target.nodeType === 8) window.__ev.push(`${T()} comment ${JSON.stringify(m.oldValue)}->${JSON.stringify(m.target.data)}`);
        for (const n of m.removedNodes) if (n.nodeType === 1 && /^S:\d+$/.test(n.id)) window.__ev.push(`${T()} removed #${n.id}`);
        for (const n of m.addedNodes) if (n.nodeType === 1 && /^S:\d+$/.test(n.id)) window.__ev.push(`${T()} added #${n.id}`); } }).observe(document, { subtree: true, childList: true, characterData: true, characterDataOldValue: true });
      document.addEventListener("DOMContentLoaded", () => window.__ev.push(`${T()} DCL`)); }); let hit = false;
    const rec = (kind, t) => { if (/418|ydrat|did not match|didn't match/i.test(t)) hit = true, hits.push(`${tag} ${route} ${kind}: ${t.slice(0, 3000)}`); };
    p.on("pageerror", (e) => rec("pageerror", String(e.stack || e.message))); p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") rec("console." + m.type(), m.text()); });
    try { await p.goto(route, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(1500); } catch (e) { hits.push(`${tag} ${route} NAV-ERR ${e.message.split("\n")[0]}`); } const ev = await p.evaluate(() => window.__ev).catch(() => []); if (route === "/settings") evs.push(`${hit ? "HIT " : "ok  "}${tag} ${ev.join(" | ")}`); await c.close(); };
  let a = 0, b = 0; for (let i = 0; i < N; i++) { await one("/signup", null); a++; await one("/settings", state); b++; }
  console.log(`[${tag} ${w}] loads /signup=${a} /settings=${b} hits=${hits.length}`); console.log(evs.join("\n")); await browser.close(); })();
