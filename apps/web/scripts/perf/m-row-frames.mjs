#!/usr/bin/env node
// /m action row, frame by frame at 390 px: where Trade / Add to combo / Alert sit from the first frame on, with /api/me and
// /api/trade/config held back 1200 ms (the late answers). The row must not change after the first frame.
// Run against a PRODUCTION build whose client has demo mode off, served with demo mode and trading on:
//   env -u DEMO_MODE pnpm build && DATA_DIR=test/fixtures DATA_SOURCE=local DATA_CLOCK=scan DEMO_MODE=true KALSHI_TRADING_ENV=demo pnpm exec next start -p 3212
//   BASE=http://localhost:3212 node scripts/perf/m-row-frames.mjs
import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (let i = 0; i < 3; i++) {
  const ctx = await b.newContext(); const p = await ctx.newPage(); for (const pat of ["**/api/trade/config", "**/api/me"]) await p.route(pat, async (r) => { await new Promise((o) => setTimeout(o, 1200)); await r.continue(); }); await p.setViewportSize({ width: 390, height: 844 });
  await p.addInitScript(() => { window.__f = []; const tick = () => { const r = [...document.querySelectorAll("a,button,span[data-testid=trade-slot]")].filter((e) => /^(Trade|Add to combo|Alert)/.test(e.textContent?.trim() ?? "")).map((e) => e.textContent.trim().slice(0, 10) + "@" + Math.round(e.getBoundingClientRect().y) + "w" + Math.round(e.getBoundingClientRect().width)).join(" "); if (window.__f.at(-1)?.[1] !== r) window.__f.push([Math.round(performance.now()), r]); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await p.goto(`${process.env.BASE ?? "http://localhost:3212"}/m/7078474`); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200);
  console.log(i, JSON.stringify(await p.evaluate(() => window.__f)));
  await ctx.close();
}
await b.close();
