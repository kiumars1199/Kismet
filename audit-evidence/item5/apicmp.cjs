const { request } = require("/home/user/wt-audit2/apps/web/node_modules/@playwright/test");
const fs = require("fs");
(async () => {
  const flags = JSON.parse(fs.readFileSync("/home/user/wt-audit2/output/flags.json", "utf8")).flags;
  const mk = JSON.parse(fs.readFileSync("/home/user/wt-audit2/output/markets.json", "utf8")).markets; const byM = new Map(mk.map((m) => [String(m.id), m])); const byId = new Map(flags.map((f) => [f.id, f])); let fromMarkets = 0;
  const ctx = await request.newContext({ baseURL: "http://localhost:3160", storageState: `${process.env.S}/states/pro.json` });
  const r = await (await ctx.get("/api/markets?ps=50")).json();
  let n = 0, bad = 0;
  for (const row of r.rows) {
    let f = byId.get(row.market.id); if (!f) { f = byM.get(row.market.id); fromMarkets++; if (!f) { console.log("missing", row.market.id); bad++; continue; } }
    for (const [i, s] of row.market.sides.entries()) for (const k of ["ask", "fee", "win_prob", "win_prob_low", "edge", "edge_low", "roi_pct"]) {
      n++; if (s[k] !== f.sides[i][k]) { bad++; console.log("MISMATCH", row.market.id, i, k, s[k], f.sides[i][k]); }
    }
    if (byId.has(row.market.id) && JSON.stringify(row.market.execution) !== JSON.stringify(f.execution)) { bad++; console.log("exec mismatch", row.market.id); }
  }
  const meta = await (await ctx.get("/api/meta")).json();
  console.log(`pro /api/markets?ps=50: ${r.rows.length} rows, ${n} side fields compared with output/flags.json, mismatches=${bad} (rows checked against flags.json: ${r.rows.length-fromMarkets}, against markets.json: ${fromMarkets}); /api/meta scanned_at=${meta.scanned_at ?? JSON.stringify(meta).slice(0,200)}; flags.json scanned_at=${JSON.parse(fs.readFileSync("/home/user/wt-audit2/output/flags.json","utf8")).scanned_at}`);
})();
