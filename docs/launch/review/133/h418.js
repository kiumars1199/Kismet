const L = require("./lib"); const H = require("./h132"); const [w,h]=process.argv[2].split("x").map(Number);
(async()=>{const {browser,page,log}=await L.start(w,h,"h418");try{await H.signup(page,`h418-${w}`,{topics:["NFL","NBA"]});
for(let i=0;i<12;i++){ if(i%3===0) await page.goto("/settings",{waitUntil:"commit"}); else if(i%3===1) await page.reload({waitUntil:"networkidle"}); else await page.goto("/settings",{waitUntil:"load"}); await page.waitForTimeout(1200);
 if(i===4){ const t=page.getByTestId("topics-picker").locator("button").nth(3); await t.scrollIntoViewIfNeeded(); await t.click(); await page.waitForTimeout(800);} }
}catch(e){console.log("ERR "+e.message.split("\n")[0]);} const errs=log.filter(l=>/pageerror|418|hydrat/i.test(l)); console.log(`[${w}] 12 settings loads, hydration errors: ${errs.length}\n${errs.join("\n")}`); await browser.close();})();
