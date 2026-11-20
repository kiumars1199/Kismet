const { chromium } = require("/home/user/wt-audit3/apps/web/node_modules/@playwright/test");
(async () => { const b = await chromium.launch();
 for (const tz of ["UTC", "America/New_York", "Asia/Tokyo"]) {
  const ctx = await b.newContext({ timezoneId: tz }); const p = await ctx.newPage();
  const html = await (await p.request.get(process.argv[2] + "/bets")).text();
  await p.goto(process.argv[2] + "/bets", { waitUntil: "load" }); await p.waitForTimeout(3000);
  const id = await p.locator("article[data-market-id]").first().getAttribute("data-market-id");
  const t = await p.locator(`article[data-market-id="${id}"] p[title^="Closes"]`).first().innerText().catch(() => "?");
  const ssr = (html.match(new RegExp(`data-market-id="${id}"[\\s\\S]*?title="Closes[^"]*"[^>]*>([^<]*)<`)) || [])[1];
  console.log(tz, "market", id, "server HTML:", ssr, "| after hydration:", t);
  await ctx.close(); }
 await b.close(); })();
