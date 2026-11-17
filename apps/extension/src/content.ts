// Content script: URL slug → background (API, 60 s cache) → badge next to each market label found on the page.
// Reads no prices from the page. State lives here and in chrome.storage, never in page globals.
import { badgeText, buildIndex, match, slugFrom, type Index } from "./match";
import type { EventResponse, Msg } from "./types";

const TAG = "me-badge";
const PILL = "me-pill";
const PILL_AFTER = 6000; // ms after data arrives with no badge on screen
let slug: string | null = null;
let data: EventResponse | null = null;
let idx: Index | null = null;
const mounted = new Map<string, HTMLElement>(); // market id → badge host
let pill: HTMLElement | null = null;
let pillTimer: ReturnType<typeof setTimeout> | undefined;

const send = <T>(msg: Msg) => chrome.runtime.sendMessage(msg) as Promise<T>;

const BADGE_CSS = `
:host { all: initial; display: block; margin-top: 4px; }
button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
  padding: 3px 10px 3px 4px; border-radius: 12px; border: 1px solid #1a2520; background: #0c120f; color: #a9bab1;
  font: 500 12px/1.4 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; cursor: pointer; white-space: normal;
  text-align: left; transition: filter 150ms ease; }
button.pos { background: #0f2a1e; border-color: #1d4a35; color: #d1fae5; }
button:hover { filter: brightness(1.2); }
b { flex: none; display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 999px;
  background: #10b981; color: #04140d; font: 700 9px/1 "Space Grotesk", system-ui, sans-serif; letter-spacing: -0.02em; }`;

function badge(text: string, positive: boolean, marketId: string | null, tag = TAG): HTMLElement {
  const host = document.createElement(tag);
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>${BADGE_CSS}${tag === PILL ? PILL_CSS : ""}</style><button class="${positive ? "pos" : ""}" title="MarketEdge: open details"><b>ME</b><span></span></button>`;
  root.querySelector("span")!.textContent = text;
  // Rows and headings are clickable on Polymarket: keep our clicks to ourselves.
  for (const ev of ["pointerdown", "mousedown", "mouseup"]) host.addEventListener(ev, (e) => e.stopPropagation());
  host.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (slug) send({ type: "open", slug, marketId });
  });
  return host;
}

const visible = (el: Element) => el.getClientRects().length > 0;

function scan() {
  if (!idx || !slug) return;
  const used = new Set([...mounted].filter(([, h]) => h.isConnected && visible(h)).map(([id]) => id));
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !n.textContent?.trim()) continue;
    seen.add(el);
    const hit = match(el.textContent ?? "", idx, used); // cheap text test first, layout reads only on hits
    if (!hit || el.closest(TAG) || el.closest("script,style,textarea,[contenteditable]") || !visible(el)) continue;
    // Sports headings sit in a tight row; put the badge under the heading row instead.
    const anchor = hit.heading ? (el.parentElement ?? el) : el;
    if (anchor.nextElementSibling?.localName === TAG) continue; // one badge per label
    const { text, positive } = badgeText(hit.market, hit.heading);
    mounted.get(hit.market.id)?.remove();
    const host = badge(text, positive, hit.market.id);
    host.dataset.meId = hit.market.id;
    anchor.after(host); // sibling, not child: labels clip overflow
    mounted.set(hit.market.id, host);
    used.add(hit.market.id);
  }
}

const PILL_CSS = `:host { all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; }
button { padding: 8px 14px 8px 6px; border-radius: 999px; font-size: 13px; border-color: #1d4a35; }`;

// Fallback (T-54): page has markets but no label matched, e.g. after a Polymarket markup change.
function checkPill() {
  if (!data || !slug) return;
  const shown = [...mounted.values()].some((h) => h.isConnected && visible(h));
  if (shown) { pill?.remove(); pill = null; return; }
  if (pill?.isConnected) return;
  // Selector breakage goes to the console only; /api/ext/telemetry comes with paid v1.
  console.warn("[MarketEdge] no outcome rows matched", { slug, markets: data.markets.length });
  const n = data.flags.length;
  pill = badge(n ? `MarketEdge: ${n} best bet${n > 1 ? "s" : ""} on this page` : "MarketEdge: no best bets on this page", n > 0, null, PILL);
  document.body.append(pill);
}

function reset() {
  for (const h of mounted.values()) h.remove();
  mounted.clear();
  pill?.remove();
  pill = null;
  clearTimeout(pillTimer);
  data = null;
  idx = null;
}

async function onUrl() {
  const s = slugFrom(location.pathname);
  if (s === slug) {
    scan();
    if (pill) checkPill(); // badges showed up late: drop the pill
    return;
  }
  slug = s;
  reset();
  if (!s) return;
  const d = await send<EventResponse | null>({ type: "event", slug: s });
  if (s !== slug || !d?.markets?.length) return;
  data = d;
  idx = buildIndex(d.markets);
  scan();
  pillTimer = setTimeout(checkPill, PILL_AFTER);
}

// SPA: Polymarket swaps pages and renders late. One throttled observer covers navigation and re-renders
// (throttle, not debounce: live prices mutate the page nonstop and would starve a debounce).
let timer: ReturnType<typeof setTimeout> | undefined;
new MutationObserver(() => {
  timer ??= setTimeout(() => { timer = undefined; onUrl(); }, 300);
}).observe(document.documentElement, { childList: true, subtree: true });
onUrl();
