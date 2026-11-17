import { ago } from "./format";
import { API } from "./types";

const $ = (id: string) => document.getElementById(id)!;

$("open").addEventListener("click", () => chrome.tabs.create({ url: API }));

fetch(`${API}/api/meta`)
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
  .then((m: { meta: { scanned_at: number } }) => {
    $("status").innerHTML = `<span class="dot" style="background:var(--accent)"></span>Connected to localhost:3000`;
    $("scan").textContent = ago(m.meta.scanned_at);
  })
  .catch(() => {
    $("status").innerHTML = `<span class="dot" style="background:var(--warning)"></span>Not connected (localhost:3000)`;
  });
