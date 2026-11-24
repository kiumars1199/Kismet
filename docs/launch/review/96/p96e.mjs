// #96: empty /check/combo and 1-leg ?m= sizes: result card, legs list, reserved wrapper, blank gap, footer position.
import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const [port, out, tag] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const fs = await import("fs"); fs.mkdirSync(out, { recursive: true });
const log = (s) => { console.log(s); fs.appendFileSync(out + "/p96e.log", s + "\n"); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [w, h] of [[390, 844], [1440, 900]]) for (const u of ["/check/combo", "/check/combo?m=6654452&side=0"]) {
  const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage();
  try { await p.goto(base + u); } catch { await p.goto(base + u); }
  await p.getByTestId("combo-msg").waitFor({ timeout: 60000 }); if (u.includes("m=")) await p.getByTestId("combo-leg").first().waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const R = (e) => e ? e.getBoundingClientRect() : null; const sy = scrollY;
    const ul = document.querySelector('[data-testid="combo-legs"]'); const s = document.querySelector('section[aria-label="Combo result"]'); const wrap = ul.parentElement;
    const foot = document.querySelector("footer"); const after = wrap.nextElementSibling;
    const a = R(ul), bx = R(s), wr = R(wrap), f = R(foot);
    return { legsH: Math.round(a.height), cardTop: Math.round(bx.top + sy), cardH: Math.round(bx.height), wrapH: Math.round(wr.height), blankUnderCard: Math.round(wr.bottom - bx.bottom), next: after ? (after.getAttribute("data-testid") || after.tagName) : null, footerTop: f ? Math.round(f.top + sy) : null, docH: document.documentElement.scrollHeight };
  });
  log(`${tag} ${w} ${u}: ${JSON.stringify(r)}`);
  await p.screenshot({ path: `${out}/${tag}-empty-${w}${u.includes("m=") ? "-1leg" : ""}.png`, fullPage: true });
  await c.close();
}
await b.close();
