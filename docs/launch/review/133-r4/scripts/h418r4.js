// r4: count React #418 over repeated loads of /signup (signed out) and /settings (signed in).
const L = require("./lib"); const H = require("./h132"); const [w, h] = process.argv[2].split("x").map(Number); const N = +(process.argv[3] || 30);
(async () => { const { browser, page, log } = await L.start(w, h, "h418r4"); const errs = []; page.on("pageerror", (e) => errs.push(page.url() + " " + String(e.message).slice(0, 80)));
  try { let s = 0; for (let i = 0; i < N; i++) { await page.goto("/signup", { waitUntil: "load" }); await page.waitForTimeout(1200); } s = errs.length; console.log(`[${w}] /signup x${N}: 418s=${s}`);
    await H.signup(page, `h418r4-${w}`, { topics: ["NFL", "NBA"] }); const b = errs.length;
    for (let i = 0; i < N; i++) { await page.goto("/settings", { waitUntil: "load" }); await page.waitForTimeout(1200); } console.log(`[${w}] /settings x${N}: 418s=${errs.length - b}`); console.log(errs.join("\n"));
  } catch (e) { console.log("ERR " + e.message.split("\n")[0]); } await browser.close(); })();
