import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium, devices } = require("@playwright/test");
const fs = await import("fs");
const base = "http://localhost:3755", OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const paths = ["/m/6596313?ref=abcd1234", "/signup?next=%2Fm%2F6596313", "/state?next=%2Fm%2F6596313"];
const tot = {};
for (const [w, h] of [[360, 640], [390, 844], [1440, 900]]) for (const path of paths) {
  let errs = 0, r418 = 0; const samples = [];
  for (let i = 0; i < 20; i++) {
    const o = w < 768 ? { ...devices["iPhone 13"], viewport: { width: w, height: h } } : { viewport: { width: w, height: h } }; delete o.defaultBrowserType;
    const ctx = await b.newContext(o); const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") { errs++; if (/418|hydrat/i.test(m.text())) r418++; if (samples.length < 3) samples.push(m.text().slice(0, 120)); } });
    p.on("pageerror", (e) => { errs++; if (/418|hydrat/i.test(e.message)) r418++; if (samples.length < 3) samples.push("pageerror " + e.message.slice(0, 120)); });
    await p.goto(base + path, { waitUntil: "load" }).catch((e) => samples.push("goto " + e.message.slice(0, 60))); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(500);
    await ctx.close();
  }
  const line = `${w} ${path} loads 20 console/page errors ${errs} react#418/hydration ${r418} ${JSON.stringify(samples)}`; console.log(line); fs.appendFileSync(`${OUT}/hydration-20x.log`, line + "\n");
}
await b.close();
