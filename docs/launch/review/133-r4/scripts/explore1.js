const L = require("./lib");
(async () => {
  const [w, h] = (process.argv[2] || "390x844").split("x").map(Number);
  const P = `x${w}`;
  const { browser, page, log, ctx } = await L.start(w, h, "wt2r2x");
  await page.goto("/", { waitUntil: "networkidle" });
  await L.shot(page, P, "landing");
  await L.audit(page, "landing");
  console.log(await L.text(page, 1500));
  console.log("--- links:", (await page.locator("a").evaluateAll((as) => as.map((a) => a.innerText.trim() + "->" + a.getAttribute("href")).filter((s) => s.length < 80))).slice(0, 40).join(" | "));
  await page.goto("/signup", { waitUntil: "networkidle" });
  await L.shot(page, P, "signup");
  await L.audit(page, "signup");
  console.log(await L.text(page, 1500));
  console.log(log.join("\n"));
  await ctx.storageState({ path: `/tmp/claude-0/-home-user/1f04416e-5530-5507-9f54-ff1b97ced093/scratchpad/wt2r2-scripts/state-${w}.json` });
  await browser.close();
})();
