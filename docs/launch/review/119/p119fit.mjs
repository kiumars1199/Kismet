import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const fs = await import("fs");
const [port, out] = process.argv.slice(2); const base = `http://localhost:${port}`;
const log = (s) => { console.log(s); fs.appendFileSync(`${out}/p119-fit.log`, s + "\n"); };
const D = JSON.parse(fs.readFileSync(process.env.CANDS, "utf8"));
const fx = JSON.parse(fs.readFileSync(process.env.WT + "/apps/web/test-results/paid-fixtures/flags.json", "utf8")).flags;
const longest = [...fx].sort((a, b) => b.question.length - a.question.length)[0];
const DIR = /^(increase|decrease|increases|decreases|hike|hikes|cut|cuts|raise|lower|higher|above|below|over|under|more|less|fewer|up|down|rise|rises|fall|falls|before|after|win|lose|yes|no|not|gain|greater|exceed|miss|beat|highest|lowest|most|fewest|top|bottom|change)$/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [w, h] of [[360, 640], [390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto(`${base}/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`); await p.getByTestId("signup-bet").waitFor({ timeout: 90000 }); await p.waitForLoadState("networkidle"); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2000);
  const res = await p.evaluate((cands) => {
    const el = document.querySelector("[data-testid=signup-bet]"); const clone = el.cloneNode(true); el.after(clone); el.style.display = "none"; const node = clone.firstChild; const LEDE = "Sign up for the verdict on: ";
    const fits = (t) => { node.nodeValue = LEDE + t; return clone.scrollHeight <= clone.clientHeight + 1; };
    const r = {};
    for (const [q, c] of Object.entries(cands)) { let lo = 0, hi = c.length - 1, best = c[hi]; while (lo <= hi) { const mid = (lo + hi) >> 1; if (fits(c[mid])) { best = c[mid]; hi = mid - 1; } else lo = mid + 1; }
      node.nodeValue = LEDE + best; const clipped = clone.scrollHeight > clone.clientHeight + 1; const lh = parseFloat(getComputedStyle(clone).lineHeight); clone.style.webkitLineClamp = "unset"; clone.style.display = "block"; const lines = Math.round(clone.getBoundingClientRect().height / lh); clone.style.display = ""; clone.style.webkitLineClamp = ""; const over = clone.scrollWidth > clone.clientWidth + 1;
      r[q] = { best, clipped, lines, over }; }
    clone.remove(); el.style.display = ""; return r; }, D.cands);
  const real = D.real.map((q) => ({ q, ...res[q] }));
  const short = real.filter((x) => x.best !== x.q);
  const norm = (s) => s.replace(/…/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const m = new Map(); for (const x of real) { const k = norm(x.best); m.set(k, [...(m.get(k) ?? []), x.q]); }
  const clashes = [...m.values()].filter((v) => v.length > 1);
  const allR = Object.entries(res).map(([q, r]) => ({ q, ...r }));
  const dirLost = allR.filter((x) => x.best !== x.q).map((x) => { const kept = x.best.toLowerCase().split(/\s+/).map((t) => t.replace(/[^a-z0-9]/g, "")); return { ...x, lost: x.q.split(/\s+/).map((t) => t.toLowerCase().replace(/[^a-z]/g, "")).filter((t) => DIR.test(t) && !kept.includes(t)) }; }).filter((x) => x.lost.length);
  const gClash = D.groups.filter((g) => norm(res[g.titles[0]].best) === norm(res[g.titles[1]].best));
  log(`== ${w}x${h} REAL: ${real.length} titles, shortened ${short.length}, over 2 lines ${real.filter((x) => x.clipped || x.lines > 2).length}, over width ${real.filter((x) => x.over).length}, clashes ${clashes.length} | ALL (incl. siblings ${Object.keys(res).length}): over 2 lines ${allR.filter((x) => x.clipped || x.lines > 2).length}, shortened that lost a direction word ${dirLost.length} | direction sibling pairs ${D.groups.length}: same visible line ${gClash.length}`);
  for (const v of clashes.slice(0, 5)) log(`   CLASH ${JSON.stringify(v)}`);
  for (const x of dirLost.slice(0, 10)) log(`   LOST [${x.lost}] "${x.best}" <= ${x.q}`);
  for (const g of gClash.slice(0, 10)) log(`   SIBLING SAME (${g.kind} ${g.pair}) "${res[g.titles[0]].best}" <= ${g.titles.map((t) => JSON.stringify(t)).join(" / ")}`);
  for (const g of D.groups.filter((g) => g.kind === "synthetic")) fs.appendFileSync(`${out}/p119-synthetic-${w}.txt`, `${g.pair}\n  ${res[g.titles[0]].best}\n  ${res[g.titles[1]].best}\n`);
  fs.writeFileSync(`${out}/p119-shortened-${w}.txt`, short.map((x) => `${x.q}\n   -> ${x.best}`).join("\n") + "\n");
  await ctx.close();
}
await b.close();
