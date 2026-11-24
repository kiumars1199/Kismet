import { chromium } from "@playwright/test";
import { appendFileSync } from "node:fs";
const BASE = process.argv[2], MID = process.argv[3], ROUNDS = +process.argv[4], LOG = process.argv[5];
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome" });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA, timezoneId: "America/New_York" });
await c.route("**/api/funnel", (r) => r.abort());
let p = await c.newPage(), err = null, hits = 0, loads = 0, crashes = 0; const byUrl = {};
const wire = (pg) => { pg.on("pageerror", (e) => { if (/418|ydrat/.test(String(e))) err = String(e).slice(0, 80); }); pg.on("console", (m) => { if (/#418|ydrat/.test(m.text())) err = err ?? m.text().slice(0, 80); }); };
wire(p);
for (let i = 0; i < ROUNDS; i++) for (const u of [`/m/${MID}?ref=abcd1234`, `/signup?next=%2Fm%2F${MID}`, `/state?next=%2Fm%2F${MID}`, `/login?next=%2Fm%2F${MID}`]) {
  err = null;
  try { await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null); await p.waitForTimeout(1200); loads++; }
  catch { crashes++; await p.close().catch(() => {}); p = await c.newPage(); wire(p); continue; }
  if (err) { hits++; const k = u.split("?")[0].replace(/\d+/, "<id>"); byUrl[k] = (byUrl[k] ?? 0) + 1; appendFileSync(LOG, `HIT load ${loads} ${u.split("?")[0]}\n`); }
  if (loads % 100 === 0) appendFileSync(LOG, `progress ${loads} hits ${hits}\n`);
}
appendFileSync(LOG, `DONE loads ${loads} crashes ${crashes} hits ${hits} ${JSON.stringify(byUrl)}\n`);
await b.close();
