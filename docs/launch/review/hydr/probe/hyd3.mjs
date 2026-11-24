import { chromium } from "@playwright/test";
const BASE = process.argv[2], MID = process.argv[3], ROUNDS = +process.argv[4] || 6;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA, timezoneId: process.env.TZ_ID || "America/New_York" });
await c.route("**/api/funnel", (r) => r.abort());
if (process.env.GET_ONLY) await c.route("**/*", (r) => (r.request().method() === "GET" ? r.continue() : r.abort()));
if (process.env.TZ_COOKIE) await c.addCookies([{ name: "tz", value: process.env.TZ_COOKIE, url: BASE }]);
import { readFileSync } from "node:fs";
const patched = readFileSync("/tmp/claude-0/chunks/a9b5e390.patched.js", "utf8");
await c.route(/\/_next\/static\/chunks\/a9b5e390-.*\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: patched }));
const detail = [];
const rows = []; const p = await c.newPage(); let err = null, loads = 0, hits = 0; const byUrl = {};
p.on("pageerror", (e) => { err = String(e).slice(0, 160); });
p.on("console", (m) => { if (m.text().startsWith("HYDR418")) { detail.push(m.text()); console.log(m.text()); } if (/#418|ydrat/.test(m.text())) err = err ?? m.text().slice(0, 160); });
for (let i = 0; i < ROUNDS; i++) for (const u of [`/m/${MID}?ref=abcd1234`, `/signup?next=%2Fm%2F${MID}`, `/state?next=%2Fm%2F${MID}`, `/login?next=%2Fm%2F${MID}`]) {
  err = null; try { await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null); await p.waitForTimeout(1200); } catch (e) { console.log("crash/skip", String(e).slice(0, 60)); continue; } loads++;
  const info = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { ttfb: Math.round(n.responseStart - n.requestStart), body: Math.round(n.responseEnd - n.responseStart), dcl: Math.round(n.domContentLoadedEventStart), load: Math.round(n.loadEventStart), size: n.transferSize, proto: n.nextHopProtocol, type: n.type, ds: Math.round(n.domInteractive), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }; });
  rows.push({ u, hit: !!err, ...info });
  if (err) { hits++; byUrl[u] = (byUrl[u] ?? 0) + 1; console.log("HIT", loads, u, err); }
}
import("node:fs").then((fs) => fs.writeFileSync(process.env.ROWS ?? "/tmp/claude-0/rows.json", JSON.stringify(rows)));
console.log(detail.join("\n"));
console.log("loads", loads, "hits", hits, JSON.stringify(byUrl));
await b.close();
