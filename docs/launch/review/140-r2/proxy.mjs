import http from "http";
// Holds the /combos document after a split point for HOLD ms. SPLIT: s0 | card | footer | mid
const PORT = +process.env.PPORT, UP = +process.env.UP, HOLD = +(process.env.HOLD || 400), SPLIT = process.env.SPLIT || "s0";
http.createServer((req, res) => {
  const up = http.request({ host: "127.0.0.1", port: UP, path: req.url, method: req.method, headers: { ...req.headers, "accept-encoding": "identity" } }, (r) => {
    const isDoc = /^\/combos(\?|$)/.test(req.url) && (r.headers["content-type"] || "").includes("text/html");
    const h = { ...r.headers }; delete h["content-length"];
    res.writeHead(r.statusCode, h);
    if (!isDoc) return r.pipe(res);
    let buf = ""; r.setEncoding("utf8"); r.on("data", (c) => (buf += c)); r.on("end", () => {
      let i = -1;
      if (SPLIT === "s0") i = buf.indexOf('<div hidden id="S:0"');
      if (SPLIT === "card" || (SPLIT === "s0" && i < 0)) { const c = buf.indexOf('data-testid="combo-card"'); i = c < 0 ? -1 : buf.lastIndexOf("<", c); }
      if (SPLIT === "footer") i = buf.indexOf("<footer");
      if (SPLIT === "mid") i = buf.length >> 1;
      console.log(req.url, "len", buf.length, "split", SPLIT, i);
      if (i < 0) return res.end(buf); res.write(buf.slice(0, i)); setTimeout(() => res.end(buf.slice(i)), HOLD); });
  });
  up.on("error", () => { res.statusCode = 502; res.end(); });
  req.pipe(up);
}).listen(PORT, "127.0.0.1", () => console.log("proxy " + PORT + " -> " + UP + " " + SPLIT));
