const { chromium } = require("/home/user/wt-audit3/apps/web/node_modules/@playwright/test");
const { generateKeyPairSync } = require("crypto");
const OUT = process.argv[2], EXT = "cgoaaiaghbckpalppklocajbdpoelmbd";
async function run(label, scopes) {
  const ctx = await chromium.launchPersistentContext("", { channel: "chromium", args: [`--disable-extensions-except=${OUT}`, `--load-extension=${OUT}`] });
  let [sw] = ctx.serviceWorkers(); sw ??= await ctx.waitForEvent("serviceworker");
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const b64 = pem.split("\n").filter((l) => l && !l.startsWith("-----")).join("");
  const keyId = "a0d1t000-0000-4000-8000-000000000002";
  const reqs = [];
  ctx.on("request", (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() ?? "", headers: r.headers() }));
  sw.on("request", (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() ?? "", headers: r.headers(), sw: true }));
  await ctx.route("https://external-api.demo.kalshi.co/**", async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace("/trade-api/v2", "");
    reqs.push({ url: req.url(), method: req.method(), body: req.postData() ?? "", headers: await req.allHeaders(), routed: true });
    if (p === "/api_keys") return route.fulfill({ json: { api_keys: [{ api_key_id: keyId, scopes }] } });
    if (p === "/portfolio/balance") return route.fulfill({ json: { balance: 100000 } });
    return route.fulfill({ json: {} });
  });
  const panel = await ctx.newPage();
  await panel.goto(`chrome-extension://${EXT}/sidepanel.html#trade`);
  await panel.getByLabel("Key ID").fill(keyId);
  await panel.getByLabel("Private key").fill(pem);
  await panel.getByRole("button", { name: "Check and connect" }).click();
  await panel.waitForTimeout(3000);
  const text = (await panel.locator("body").innerText()).replace(/\s+/g, " ");
  const connected = text.includes("Demo key connected");
  const pkField = await panel.getByLabel("Private key").count();
  const storage = await sw.evaluate(async () => {
    const local = await chrome.storage.local.get(null), session = await chrome.storage.session.get(null);
    const idb = await new Promise((res) => { const r = indexedDB.open("kismet-vault"); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains("keys")) return res([]); const t = db.transaction("keys").objectStore("keys").getAll(); t.onsuccess = () => res(t.result.map((v) => ({ type: typeof v, keys: Object.keys(v ?? {}), cryptoKey: Object.values(v ?? {}).filter((x) => x instanceof CryptoKey).map((k) => ({ extractable: k.extractable, usages: k.usages, alg: k.algorithm.name })) }))); }; });
    let exported = "n/a";
    return { local: JSON.stringify(local), session: JSON.stringify(session), idb, exported };
  });
  const pageLS = await panel.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  const leakReq = reqs.filter((r) => (r.body + JSON.stringify(r.headers) + r.url).includes(b64.slice(10, 40)));
  const hosts = [...new Set(reqs.map((r) => new URL(r.url).host))];
  console.log(`== ${label}: scopes=${JSON.stringify(scopes)}`);
  console.log(`   connected=${connected} privateKeyFieldStillShown=${pkField}`);
  console.log(`   panel says: ${text.match(/(This key[^.]*\.[^.]*\.|Demo key connected[^.]{0,40})/)?.[0] ?? text.slice(0, 200)}`);
  console.log(`   requests: ${reqs.length}, hosts: ${hosts.join(", ")}`);
  console.log(`   requests containing key material: ${leakReq.length}`);
  console.log(`   PEM in chrome.storage.local: ${storage.local.includes(b64.slice(10, 40))}, session: ${storage.session.includes(b64.slice(10, 40))}, page local/sessionStorage: ${pageLS.includes(b64.slice(10, 40))}`);
  console.log(`   chrome.storage.local keys: ${Object.keys(JSON.parse(storage.local)).join(",") || "(none)"}; session keys: ${Object.keys(JSON.parse(storage.session)).join(",") || "(none)"}`);
  console.log(`   IndexedDB kismet-vault/keys: ${JSON.stringify(storage.idb)}`);
  await ctx.close();
}
(async () => {
  await run("trade-only key", ["read", "write::trade"]);
  await run("key with transfer scope", ["read", "write::trade", "write::transfer"]);
  await run("key with wildcard", ["read", "write::*"]);
})().catch((e) => { console.error(e); process.exit(1); });
