// WT2 final: #418 hunt. Fresh browser context per load. args <WxH> <N> <tag>. env BASE. Prints every hydration-ish console error/pageerror in full.
const L = require("./lib"); const H = require("./h132"); const { chromium } = require("playwright");
const [w, h] = process.argv[2].split("x").map(Number); const N = +process.argv[3]; const tag = process.argv[4];
(async () => { const { browser, ctx, page } = await L.start(w, h, "h418c-" + tag); const hits = [];
  await H.signup(page, `h418c-${tag}`, { topics: ["NFL", "NBA"] }); const state = await ctx.storageState();
  const one = async (route, st) => { const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, baseURL: process.env.BASE, ...(st ? { storageState: st } : {}) }); const p = await c.newPage(); let html = null; let hit = false; p.on("response", async (r) => { if (r.request().resourceType() === "document") { try { html = await r.text(); } catch {} } });
    const rec = (kind, t) => { if (/418|ydrat|did not match|didn't match/i.test(t)) hit = true, hits.push(`${tag} ${route} ${kind}: ${t.slice(0, 3000)}`); };
    p.on("pageerror", (e) => rec("pageerror", String(e.stack || e.message))); p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") rec("console." + m.type(), m.text()); });
    try { await p.goto(route, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(1500); } catch (e) { hits.push(`${tag} ${route} NAV-ERR ${e.message.split("\n")[0]}`); }
    if (hit) { const fs = require("fs"); const base = `${process.env.OUT}/h418-captures/${tag}-${route.slice(1)}-${Date.now()}`; fs.writeFileSync(base + "-server.html", html || ""); fs.writeFileSync(base + "-client.html", await p.content().catch(() => "")); }
    await c.close(); };
  let a = 0, b = 0; for (let i = 0; i < N; i++) { await one("/signup", null); a++; await one("/settings", state); b++; }
  console.log(`[${tag} ${w}] loads /signup=${a} /settings=${b} hits=${hits.length}`); console.log(hits.join("\n---\n")); await browser.close(); })();
