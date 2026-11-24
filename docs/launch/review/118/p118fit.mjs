import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const fs = await import("fs");
const [port, out] = process.argv.slice(2); const base = `http://localhost:${port}`;
const log = (s) => { console.log(s); fs.appendFileSync(`${out}/p118-fit.log`, s + "\n"); };
const data = JSON.parse(fs.readFileSync(process.env.CANDS, "utf8"));
const fx = JSON.parse(fs.readFileSync(process.env.WT + "/apps/web/test-results/paid-fixtures/flags.json", "utf8")).flags;
const longest = [...fx].sort((a, b) => b.question.length - a.question.length)[0];
const CRIT = /^(not|no|or|higher|lower|between|than|exactly|fewer|less|more|above|below|up|down|under|over|without|and|least|most|only|any|yes|before|after|by)$/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [w, h] of [[360, 640], [390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto(`${base}/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`); await p.getByTestId("signup-bet").waitFor({ timeout: 90000 }); await p.waitForLoadState("networkidle"); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2000);
  const res = await p.evaluate((data) => {
    const el = document.querySelector("[data-testid=signup-bet]"); const clone = el.cloneNode(true); el.after(clone); el.style.display = "none"; const node = clone.firstChild; const LEDE = "Sign up for the verdict on: ";
    const fits = (t) => { node.nodeValue = LEDE + t; return clone.scrollHeight <= clone.clientHeight + 1; };
    const r = [];
    for (const { q, c } of data) { let lo = 0, hi = c.length - 1, best = c[hi]; while (lo <= hi) { const mid = (lo + hi) >> 1; if (fits(c[mid])) { best = c[mid]; hi = mid - 1; } else lo = mid + 1; }
      // also: the true longest fitting candidate by linear scan (binary search assumes monotone)
      let lin = null; for (const x of c) if (fits(x)) { lin = x; break; }
      node.nodeValue = LEDE + best; const clamp = clone.scrollHeight > clone.clientHeight + 1; const lh = parseFloat(getComputedStyle(clone).lineHeight);
      clone.style.webkitLineClamp = "unset"; clone.style.display = "block"; const lines = Math.round(clone.getBoundingClientRect().height / lh); clone.style.display = ""; clone.style.webkitLineClamp = "";
      r.push({ q, best, clipped: clamp, lines, linDiffers: lin !== best }); }
    clone.remove(); el.style.display = ""; return r; }, data);
  const short = res.filter((x) => x.best !== x.q);
  const m = new Map(); for (const x of res) m.set(x.best, [...(m.get(x.best) ?? []), x.q]);
  const coll = [...m.entries()].filter(([, v]) => v.length > 1);
  // "reads the same": compare with ellipses removed and whitespace collapsed
  const norm = (s) => s.replace(/…/g, " ").replace(/\s+/g, " ").trim();
  const m2 = new Map(); for (const x of res) { const k = norm(x.best); m2.set(k, [...(m2.get(k) ?? []), x.q]); }
  const coll2 = [...m2.entries()].filter(([, v]) => v.length > 1);
  const lostDigits = short.filter((x) => (x.q.match(/\d+/g) ?? []).join() !== (x.best.match(/\d+/g) ?? []).join());
  const crit = short.map((x) => { const kept = new Set(x.best.split(" ")); return { ...x, dropped: x.q.split(" ").filter((wd) => !kept.has(wd)) }; }).filter((x) => x.dropped.some((d) => CRIT.test(d.replace(/[^\w]/g, ""))));
  log(`== ${w}x${h}: ${res.length} titles, shortened ${short.length}, over 2 lines (clipped) ${res.filter((x) => x.clipped).length}, max lines ${Math.max(...res.map((x) => x.lines))}, identical lines for different bets ${coll.length}, same after removing "…" ${coll2.length}, binary search != longest fitting ${res.filter((x) => x.linDiffers).length}, shortened that lost a number ${lostDigits.length}, shortened that dropped a meaning word ${crit.length}`);
  for (const [k, v] of coll.slice(0, 5)) log(`   SAME "${k}" <= ${v.map((x) => JSON.stringify(x)).join(" / ")}`);
  for (const x of lostDigits.slice(0, 5)) log(`   LOST NUMBER "${x.best}" <= ${x.q}`);
  for (const x of crit.slice(0, 12)) log(`   DROPPED [${x.dropped.filter((d) => CRIT.test(d.replace(/[^\w]/g, ""))).join(",")}] "${x.best}" <= ${x.q}`);
  for (const x of short.slice(0, 25)) fs.appendFileSync(`${out}/p118-shortened-${w}.txt`, `${x.q}\n   -> ${x.best}\n`);
  for (const x of short.slice(25)) fs.appendFileSync(`${out}/p118-shortened-${w}.txt`, `${x.q}\n   -> ${x.best}\n`);
  await ctx.close();
}
await b.close();
