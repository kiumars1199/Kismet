// /markets CLS with N favorite topics set in onboarding, plus signed-out pages. args: <WxH> <n topics>
const L = require("./lib"); const H = require("./h132");
const [w, h] = process.argv[2].split("x").map(Number); const n = +process.argv[3];
const ALL = ["NFL", "College football", "NBA", "College basketball", "Soccer", "Hockey", "Baseball"];
(async () => {
  const { browser, page, log } = await L.start(w, h, `mk-${n}`);
  try {
    if (n === 0) {
      for (const p of ["/", "/markets", "/settings", "/onboarding"]) { await page.goto(p, { waitUntil: "networkidle" }); await page.waitForTimeout(1500); await L.audit(page, `${w} signed-out ${p}`); }
      await L.shot(page, `signedout-${w}`, "last");
    } else {
      await H.signup(page, `mk${n}`, { topics: ALL.slice(0, n) });
      for (let i = 0; i < 2; i++) { await page.goto("/markets", { waitUntil: "networkidle" }); await page.waitForTimeout(2000); await L.audit(page, `${w} fav${n} markets try${i}`); }
      await L.shot(page, `mk-${w}-fav${n}`, "markets");
    }
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); }
  console.log(log.filter((l) => !/429|preload/.test(l)).join("\n")); await browser.close();
})();
