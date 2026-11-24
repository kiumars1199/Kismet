const L = require("./lib"); const H = require("./h132");
(async()=>{ const out=[]; for (const k of [1,2]) { const {browser,page}=await L.start(1440,900,"free"+k); try{ await H.signup(page,`free133-${k}`,{topics:["NBA","Soccer","Hockey"]});
 for (const u of ["/bets?fav=1&t=sports.nba%2Csports.soccer%2Csports.nhl","/bets"]) { await page.goto(u,{waitUntil:"networkidle"}); await page.waitForTimeout(1500);
  const h1=await page.locator("h1").first().innerText(); const rows=await page.evaluate(()=>[...document.querySelectorAll('main a[href*="/market"], main [data-testid*="bet"]')].slice(0,40).map(a=>a.textContent.trim().slice(0,30)));
  out.push(`[user${k}] ${u} h1="${h1}" first=${JSON.stringify(rows.slice(0,6))}`);} } catch(e){out.push("ERR "+e.message.split("\n")[0]);} await browser.close(); }
 console.log(out.join("\n")); })();
