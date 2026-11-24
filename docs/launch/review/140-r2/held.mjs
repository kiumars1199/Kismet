import { launch, base, out, L, init, signIn } from "./lib.mjs";
const P = "http://localhost:4352";
const b = await launch();
for (const [w, h] of [[390, 844], [375, 667], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, extraHTTPHeaders: { "x-e2e-device": `r140-held-${w}-${Date.now()}` } });
  await ctx.addInitScript(init); const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  await signIn(p, "premium", `r140-held-${w}-${Date.now()}@example.com`);
  for (const path of ["/combos", "/combos?pays=5"]) for (let i = 0; i < 2; i++) {
    await p.goto(P + path, { waitUntil: "load" }); await p.waitForTimeout(1500);
    const m = await p.evaluate(() => ({ cls: +window.__cls.toFixed(4), s: window.__s, cards: document.querySelectorAll("[data-testid=combo-card]").length }));
    L(`${w} held-400ms ${path} #${i}: CLS ${m.cls} cards ${m.cards} ${JSON.stringify(m.s)}`);
  }
  // screenshot mid-stream
  const pr = p.goto(P + "/combos", { waitUntil: "load" }); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/held-${process.env.SPLIT}-${w}-before-list.png` }).catch(() => {}); await pr;
  await ctx.close();
}
await b.close();
