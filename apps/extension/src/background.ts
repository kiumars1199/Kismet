// Service worker: API calls with a 60 s cache per slug, and opening the side panel. No window.* here.
import { API, type EventResponse, type Msg, type Selection } from "./types";

const TTL = 60_000;

async function eventBySlug(slug: string): Promise<EventResponse | null> {
  const key = `ev:${slug}`;
  const hit = (await chrome.storage.session.get(key))[key] as { at: number; data: EventResponse | null } | undefined;
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  let data: EventResponse | null = null;
  try {
    const res = await fetch(`${API}/api/events/by-slug/${encodeURIComponent(slug)}`);
    if (res.ok) data = (await res.json()) as EventResponse;
    else if (res.status !== 404) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.warn("[MarketEdge] API unreachable", slug, e);
    return null; // not cached: retry on next navigation
  }
  await chrome.storage.session.set({ [key]: { at: Date.now(), data } });
  return data;
}

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  if (msg.type === "open") {
    // Must run before any await, or Chrome drops the user gesture.
    const tabId = sender.tab?.id;
    if (tabId !== undefined) chrome.sidePanel.open({ tabId }).catch((e) => console.warn("[MarketEdge] side panel", e));
    const sel: Selection = { slug: msg.slug, marketId: msg.marketId, at: Date.now() };
    chrome.storage.local.set({ selection: sel });
    return false;
  }
  if (msg.type === "event") {
    eventBySlug(msg.slug).then(reply);
    return true; // async reply
  }
  return false;
});
