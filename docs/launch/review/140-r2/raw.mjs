import { launch, base, out, L, signIn } from "./lib.mjs";
import fs from "fs";
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-e2e-device": `r140r2-raw-${Date.now()}` } });
const p = await ctx.newPage();
await signIn(p, "premium", `r140r2-raw-${Date.now()}@example.com`);
const cookies = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
fs.writeFileSync(out + "/cookie.txt", cookies);
for (const path of ["/combos", "/bets"]) {
  const html = await (await p.request.get(base + path)).text();
  fs.writeFileSync(`${out}/raw${path.replace("/", "-")}.html`, html);
  const footer = html.indexOf("<footer"), card = html.indexOf('data-testid="combo-card"'), susp = [...html.matchAll(/<!--\$\?-->|<template id="B:\d+"|<div hidden id="S:\d+"/g)].map((m) => m[0] + "@" + m.index);
  L(`${path}: len ${html.length} footer@${footer} firstCard@${card} suspense ${JSON.stringify(susp.slice(0, 6))}`);
}
await b.close();
