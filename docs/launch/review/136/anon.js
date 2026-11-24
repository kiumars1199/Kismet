const L = require("./lib");
(async () => { for (const [w, h] of [[820, 1180], [1100, 800], [1280, 720]]) {
  const { browser, page } = await L.start(w, h, "anon");
  for (const u of ["/markets", `/markets?m=${process.env.MID}&side=0`]) {
    await page.goto(u, { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
    const r = await page.evaluate(() => { const all = [...document.querySelectorAll("header")]; const q = document.querySelector("header"); return { url: location.pathname + location.search, h1: document.querySelector("h1")?.innerText, n: all.length, firstIsSite: q?.className.includes("lg:sticky"), list: all.map((x) => x.className.includes("lg:sticky") ? "SITE" : (x.innerText || "").slice(0, 30).replace(/\n/g, " ")), pos: q && getComputedStyle(q).position, dialog: !!document.querySelector('[role="dialog"]'), chooser: !!document.querySelector('button[title="Choose columns"]') }; });
    console.log(`[${w} anon] ${JSON.stringify(r)}`);
  }
  await browser.close(); } })().catch((e) => console.log("ERR " + e.stack));
