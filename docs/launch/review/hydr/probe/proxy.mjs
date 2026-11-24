import http from "node:http";
const UP = 3730, PORT = 3731, DELAY = +process.env.DELAY || 800, MODE = process.env.MODE || "tail";
http.createServer((req, res) => {
  const up = http.request({ host: "127.0.0.1", port: UP, path: req.url, method: req.method, headers: { ...req.headers, "accept-encoding": "identity" } }, (r) => {
    const html = (r.headers["content-type"] || "").includes("text/html");
    const h = { ...r.headers }; delete h["content-length"];
    res.writeHead(r.statusCode, h);
    if (!html) return r.pipe(res);
    if (MODE === "jitter") {
      const q = []; let busy = false, ended = false;
      const pump = () => { if (busy) return; busy = true; const step = () => { const c = q.shift(); if (!c) { busy = false; if (ended) res.end(); return; } res.write(c); setTimeout(step, Math.random() * (+process.env.JIT || 40)); }; step(); };
      r.on("data", (d) => { let i = 0; while (i < d.length) { const n = 200 + Math.floor(Math.random() * 1400); q.push(d.subarray(i, i + n)); i += n; } pump(); });
      r.on("end", () => { ended = true; if (!busy) res.end(); });
      return;
    }
    // forward the first part at once, hold back everything from the first "<div hidden id=\"S:" (the late Suspense payloads) by DELAY ms
    let buf = "", released = false, held = [];
    r.on("data", (d) => {
      const s = d.toString("utf8");
      if (!released && MODE === "tail") {
        buf += s; const i = buf.indexOf('<div hidden id="S:');
        if (i >= 0) { res.write(buf.slice(0, i)); held.push(buf.slice(i)); released = true; buf = ""; }
        else if (buf.length > 20000) { res.write(buf.slice(0, -2000)); buf = buf.slice(-2000); }
      } else if (released) held.push(s); else res.write(s);
    });
    r.on("end", () => { if (buf) res.write(buf); setTimeout(() => { res.end(held.join("")); }, released ? DELAY : 0); });
  });
  req.pipe(up);
}).listen(PORT, () => console.log("proxy up", PORT));
