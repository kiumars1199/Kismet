// Fetches each page N times with the exact UA/headers used by the A/B harness and records, per fetch: is <title> inside
// <head>, how many pending boundaries (<!--$?-->), whether the $RC/$RV reveal script is present, TTFB and total time.
// usage: node html-check.mjs <base-url> <market-id> <N> <out-prefix>
// The first fetch after server start is reported separately ("cold"): it renders slower than later ones and the
// metadata boundaries resolve before the first flush, so its HTML has the title in <head> and no pending boundary.
import http from "node:http";
import { writeFileSync } from "node:fs";
const [base, mid, N, out] = [process.argv[2], process.argv[3], +process.argv[4], process.argv[5]];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const pages = [`/state?next=%2Fm%2F${mid}`, `/m/${mid}`, "/signup"];
const get = (path) => new Promise((resolve, reject) => {
  const t0 = performance.now(); let ttfb = 0; const chunks = [];
  http.get(base + path, { headers: { "user-agent": UA, "accept-encoding": "identity" } }, (r) => {
    r.on("data", (d) => { if (!ttfb) ttfb = performance.now() - t0; chunks.push(d); });
    r.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8"), ttfb, total: performance.now() - t0, status: r.statusCode }));
  }).on("error", reject);
});
const facts = (html) => { const head = html.slice(0, html.indexOf("</head>")); return { titleInHead: head.includes("<title>"), pendingBoundaries: html.split("<!--$?-->").length - 1, revealScript: /\$RC=|\$RV=/.test(html) }; };
const rows = [];
for (const p of pages) for (let i = 0; i < N; i++) {
  const r = await get(p);
  rows.push({ page: p.split("?")[0].replace(mid, "<id>"), i, cold: rows.length === 0, status: r.status, ttfbMs: Math.round(r.ttfb), totalMs: Math.round(r.total), ...facts(r.html) });
  if (i === 1 && p.startsWith("/state")) writeFileSync(`${out}-state-warm.html`, r.html);
  if (rows.length === 1) writeFileSync(`${out}-state-cold.html`, r.html);
}
writeFileSync(`${out}.json`, JSON.stringify(rows));
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const p of [...new Set(rows.map((r) => r.page))]) {
  const w = rows.filter((r) => r.page === p && !r.cold);
  console.log(`${out} ${p}: ${w.length} warm fetches | titleInHead ${w.filter((r) => r.titleInHead).length} | pendingBoundaries>0 ${w.filter((r) => r.pendingBoundaries > 0).length} | revealScript ${w.filter((r) => r.revealScript).length} | ttfb median ${med(w.map((r) => r.ttfbMs))} ms, p90 ${w.map((r) => r.ttfbMs).sort((a, b) => a - b)[Math.floor(w.length * 0.9)]} ms`);
}
const c = rows[0]; console.log(`${out} cold first fetch (${c.page}): titleInHead ${c.titleInHead}, pendingBoundaries ${c.pendingBoundaries}, revealScript ${c.revealScript}, ttfb ${c.ttfbMs} ms`);
