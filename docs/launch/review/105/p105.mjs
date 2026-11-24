// #77 table overflow: /m chart + empty state, CLS per plan, Trade/combo slots, venues block, history API per tier.
import { createRequire } from "module";
const require = createRequire(process.env.WT + "/apps/web/package.json");
const { chromium } = require("@playwright/test");
const [port, out] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const svc = { authorization: "Bearer e2e-service", apikey: "e2e-anon", "content-type": "application/json" };
const subs = async () => (await (await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions`, { headers: svc })).json());
const DISC = "Market analytics, not financial advice. Based on past results. 18+.";
const init = () => { window.__cls = 0; window.__s = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__s.push(e.value.toFixed(4) + " " + (e.sources || []).map((s) => (s.node?.getAttribute?.("data-testid") || s.node?.tagName) + ` y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`).join(",")); } }).observe({ type: "layout-shift", buffered: true }); };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function signIn(page, plan, email) {
  const before = new Set((await subs()).map((r) => r.user_id));
  try { await page.goto(base + "/login"); } catch { await page.goto(base + "/login"); }
  for (let i = 0; i < 30; i++) { try { await page.getByRole("tab", { name: "Email link" }).click({ timeout: 2000 }); await page.getByRole("button", { name: "Email me a sign-in link" }).waitFor({ timeout: 2000 }); break; } catch {} }
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 30000 });
  const { url } = await (await fetch(`${base}/e2e-mock/supabase/_inbox?email=${encodeURIComponent(email)}`)).json();
  await page.goto(url);
  await page.waitForURL((u) => !/login|auth|callback/.test(u.pathname), { timeout: 90000 });
  await page.waitForLoadState("networkidle");
  if (!/onboarding/.test(page.url())) return;
  const mine = (await subs()).find((r) => !before.has(r.user_id));
  if (plan !== "free") await fetch(`${base}/e2e-mock/supabase/rest/v1/subscriptions?user_id=eq.${mine.user_id}`, { method: "PATCH", headers: svc, body: JSON.stringify({ comp_tier: plan, comp_expires_at: null }) });
  await page.getByRole("button", { name: "Skip setup" }).click({ timeout: 60000 });
  await page.waitForURL((u) => u.pathname !== "/onboarding", { timeout: 60000 });
  await page.waitForLoadState("networkidle");
  const skip = page.getByRole("button", { name: "Skip tour" }); if (await skip.isVisible().catch(() => false)) await skip.click();
}
const fs = await import("fs"); fs.mkdirSync(out, { recursive: true }); const tag = process.env.TAG || "A";
const log = (s) => { console.log(s); fs.appendFileSync(out + "/p105.log", s + "\n"); };
for (const who of ["out", "free"]) for (const [w, h] of [[390, 844], [1440, 900]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768 }); await c.addInitScript(init); const p = await c.newPage();
  if (who === "free") await signIn(p, "free", `p105-${w}-${Date.now()}@example.com`);
  await p.evaluate(() => { window.__cls = 0; window.__s = []; }).catch(() => {});
  try { await p.goto(base + "/pricing"); } catch { await p.goto(base + "/pricing"); }
  await p.waitForLoadState("networkidle"); await p.waitForTimeout(2500);
  const cls = await p.evaluate(() => [+window.__cls.toFixed(4), window.__s.join(" ; ")]);
  const sum = await p.getByTestId("proof-summary").innerText().catch(() => null);
  await p.getByTestId("proof-summary").click().catch(() => {}); await p.waitForTimeout(600);
  const det = await p.getByTestId("proof-details").innerText().catch(() => null);
  const body = await p.locator("body").innerText();
  const winNoRet = (det || "").split(/(?<=\.)\s/).filter((s) => /\d+% (won|of the time)|win rate/i.test(s) && !/(made|lost|return|[+−-]\d+(\.\d+)?%)/i.test(s));
  const side = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  log(`${tag} ${who} ${w}: CLS ${cls[0]} [${cls[1]}] | summary: ${sum} | details: ${JSON.stringify(det)} | win-rate-without-return sentences: ${JSON.stringify(winNoRet)} | disclaimer ${body.includes(DISC)} | cents ${/\d¢|\bcents?\b/i.test(body)} | sideways ${side}`);
  await p.screenshot({ path: `${out}/${tag}-${who}-${w}-details.png`, fullPage: w > 800 });
  await c.close();
}
await b.close();
