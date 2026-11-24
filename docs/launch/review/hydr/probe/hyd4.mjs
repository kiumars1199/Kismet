import { chromium } from "@playwright/test";
const BASE = process.argv[2], MID = process.argv[3], ROUNDS = +process.argv[4] || 6, CPU = +process.env.CPU || 0;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome" });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA, timezoneId: "America/New_York" });
await c.route("**/api/funnel", (r) => r.abort());
let hits = 0, loads = 0, skipped = 0; const byUrl = {};
for (let i = 0; i < ROUNDS; i++) for (const u of [`/m/${MID}?ref=abcd1234`, `/signup?next=%2Fm%2F${MID}`, `/state?next=%2Fm%2F${MID}`, `/login?next=%2Fm%2F${MID}`]) {
  let err = null; let p;
  try {
    p = await c.newPage();
    p.on("pageerror", (e) => { if (/418|ydrat/.test(String(e))) err = String(e).slice(0, 100); });
    p.on("console", (m) => { if (/#418|ydrat/.test(m.text())) err = err ?? m.text().slice(0, 100); });
    if (CPU) { const cd = await c.newCDPSession(p); await cd.send("Emulation.setCPUThrottlingRate", { rate: CPU }); }
    await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null); await p.waitForTimeout(1200); loads++;
  } catch (e) { skipped++; }
  if (err) { hits++; byUrl[u.split("?")[0]] = (byUrl[u.split("?")[0]] ?? 0) + 1; console.log("HIT", loads, u.split("?")[0]); }
  await p?.close().catch(() => {});
}
console.log("loads", loads, "skipped", skipped, "hits", hits, JSON.stringify(byUrl));
await b.close();
