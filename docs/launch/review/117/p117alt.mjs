import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const fs = await import("fs");
const [port, out] = process.argv.slice(2); const base = `http://localhost:${port}`;
const log = (s) => { console.log(s); fs.appendFileSync(`${out}/p117-fold.log`, s + "\n"); };
const flags = JSON.parse(fs.readFileSync(process.env.WT + "/apps/web/test-results/paid-fixtures/flags.json", "utf8")).flags;
const longest = [...flags].sort((a, b) => b.question.length - a.question.length)[0];
const real = JSON.parse(fs.readFileSync("/home/user/MarketEdge/output/flags.json", "utf8")).flags.map((f) => f.question);
const lens = real.map((q) => q.length).sort((a, b) => a - b); const pct = (p) => lens[Math.floor(p * (lens.length - 1))];
log(`real flags title length: p50 ${pct(0.5)} p90 ${pct(0.9)} p99 ${pct(0.99)} max ${lens.at(-1)}; >80 ch: ${lens.filter((l) => l > 80).length}/${lens.length}`);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [w, h] of [[360, 640], [375, 667], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto(`${base}/signup?next=${encodeURIComponent(`/m/${longest.id}`)}`); await p.getByTestId("signup-bet").waitFor({ timeout: 90000 }); await p.waitForTimeout(800);
  // how many whole real titles fit in 2 lines with today's lede vs a shorter lede
  for (const lede of ["Sign up to see Kismet's verdict on ", "Kismet's verdict on: ", "Sign up to see the verdict on: "]) {
    const r = await p.evaluate(({ lede, qs }) => { const l = document.querySelector("[data-testid=signup-bet]"); const lh = parseFloat(getComputedStyle(l).lineHeight); let fit = 0; for (const q of qs) { l.textContent = lede + q; if (Math.round(l.getBoundingClientRect().height / lh) <= 2) fit++; } return fit; }, { lede, qs: real });
    log(`${w}x${h} lede "${lede.trim()}": ${r}/${real.length} real flag titles fit WHOLE in 2 lines (${(100 * r / real.length).toFixed(1)}%)`);
  }
  await ctx.close();
}
await b.close();
