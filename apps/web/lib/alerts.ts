// Alerts evaluator (docs/05 F-11, F-23; docs/10 demo deltas). Runs in the open tab in demo mode and
// on the server for signed-in users (lib/alerts-server.ts, /api/alerts/run).
// Pure over injected fetchers so it is unit-testable. Messages never say "bet this".
import type { MarketsResponse } from "@/lib/api";
import { closesIn, pct, ret } from "@/lib/format";
import { formatOdds } from "@/lib/odds";
import { FilterState } from "@/lib/filters/state";
import type { AlertEvent, AlertKind, AlertRule, OddsFormat, Repo } from "@/lib/repo/types";
import { UniqueViolation } from "@/lib/repo/types";
import type { BigTrade } from "@/lib/bigtrade";
import type { Settlement } from "@/lib/journal";
import type { Execution, Market, Side } from "@/lib/types";

export const KIND_LABEL: Record<AlertRule["kind"], string> = {
  preset_match: "New market in a view",
  market_price: "Price drops to a target",
  edge_change: "Estimated return crosses a level",
  closing_soon: "Market closing soon",
  settled: "Market settled",
  big_trade: "Big trade ($10,000+)",
};

const bucket = (now: Date, cooldownMin: number) => Math.floor(now.getTime() / (Math.max(1, cooldownMin) * 60_000));
export const dedupeKey = (r: Pick<AlertRule, "id" | "cooldown_minutes">, marketId: string, side: 0 | 1 | null, now: Date) =>
  `${r.id}|${marketId}|${side ?? ""}|${bucket(now, r.cooldown_minutes)}`;

export function inQuietHours(r: Pick<AlertRule, "quiet_hours">, now: Date, timeZone: string): boolean {
  if (!r.quiet_hours) return false;
  const [a, b] = r.quiet_hours;
  let h: number;
  try { h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now)); }
  catch { h = now.getHours(); }
  return a <= b ? h >= a && h < b : h >= a || h < b;
}

function closesAt(unixSec: number, timeZone: string): string {
  const d = new Date(unixSec * 1000);
  try { return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone }); }
  catch { return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }); }
}

/** "Jaguars · pays 1.39x · won 79% before · estimated return +7% · closes Sun 1:00 PM" */
export function message(m: Market, s: Side, timeZone: string, live?: { ask: number; roi: number } | null, odds: OddsFormat = "percent"): string {
  const ask = live?.ask ?? s.ask;
  const roi = live?.roi ?? s.roi_pct;
  return [`${s.outcome} · pays ${odds === "american" ? formatOdds(ask, odds) : formatOdds(ask, "decimal")}`, `won ${pct(s.win_prob)} before`, `estimated return ${ret(roi)}`,
    m.closes_at ? `closes ${closesAt(m.closes_at, timeZone)} (${closesIn(m.closes_at)})` : null].filter(Boolean).join(" · ");
}
export const title = (m: Market) => `${m.niche.toUpperCase()} · ${m.question}`;

type Live = (Execution & { book_ok: true }) | null;
export interface Deps {
  repo: Repo;
  /** Evaluate only these kinds (the post-scan big-trade run). The other rules still count as context, e.g. for the
   *  markets a general big_trade rule follows. Omitted: every kind. */
  kinds?: AlertKind[];
  /** Whose rules these are (the server passes the user id). F16 dedupes a trade per user with it, so two of their
   *  rules never send the same trade, whichever runs first. Omitted (the in-browser demo): per rule. */
  owner?: string;
  fetchMarkets: (q: FilterState) => Promise<MarketsResponse>;
  fetchMarket: (id: string) => Promise<Market | null>;
  fetchBook: (token: string, q: number, cat: string) => Promise<Live>;
  /** "settled" rules: has this market resolved (Polymarket's own market status, lib/settle.ts)? Omitted: those rules never fire. */
  fetchSettlement?: (id: string) => Promise<Settlement>;
  /** "big_trade" rules (F16, Premium): recent trades of $10,000+ in these Polymarket events. Omitted: those rules never fire. */
  fetchBigTrades?: (eventIds: string[], sinceSec: number) => Promise<BigTrade[]>;
  now?: Date;
  timeZone: string;
  odds?: OddsFormat;
  /** per-rule memory between runs in this tab: matched market keys (preset_match), last above/below (edge_change) */
  memory: Map<string, Set<string> | boolean>;
}

interface Hit { market: Market; side: Side; live?: { ask: number; roi: number } | null }
export const liveRoi = (x: Execution) => (x.net_edge / (x.best_ask + x.fee_at_ask)) * 100;

async function candidates(rule: AlertRule, d: Deps): Promise<Hit[]> {
  if (rule.kind === "preset_match") {
    const q = FilterState.safeParse(rule.query ?? {});
    if (!q.success) return [];
    const res = await d.fetchMarkets({ ...q.data, group_by_event: false, page: 1, page_size: 50 });
    const keys = res.rows.map((r) => `${r.market.id}|${r.side.side_index}`);
    const prev = d.memory.get(rule.id);
    d.memory.set(rule.id, new Set(keys));
    const fresh = res.rows.filter((r, i) => !(prev instanceof Set) || !prev.has(keys[i]!));
    return fresh.slice(0, Math.max(1, Math.min(10, rule.threshold ?? 1))).map((r) => ({ market: r.market, side: r.side }));
  }
  if (rule.kind === "closing_soon") {
    const ids = rule.market_id ? [rule.market_id] : [...new Set((await d.repo.watchlist.list()).map((w) => w.market_id))].slice(0, 20);
    const hours = rule.threshold ?? 6;
    const now = (d.now ?? new Date()).getTime() / 1000;
    const hits: Hit[] = [];
    for (const id of ids) {
      const m = await d.fetchMarket(id);
      if (!m || !m.closes_at) continue;
      const left = m.closes_at - now;
      if (left > 0 && left <= hours * 3600) hits.push({ market: m, side: m.sides[rule.side_index ?? m.best.side_index] ?? m.best });
    }
    return hits;
  }
  // market_price / edge_change: live book for the one token
  if (!rule.market_id || rule.threshold == null) return [];
  const m = await d.fetchMarket(rule.market_id);
  if (!m || m.closes_at * 1000 <= (d.now ?? new Date()).getTime()) return [];   // closed: no bet left to alert on
  const s = m.sides[rule.side_index ?? m.best.side_index] ?? m.best;
  const token = m.tokens[s.side_index];
  const x = token ? await d.fetchBook(token, s.win_prob, m.category) : null;
  if (!x) return [];
  const live = { ask: x.best_ask, roi: liveRoi(x) };
  if (rule.kind === "market_price") return x.best_ask <= rule.threshold ? [{ market: m, side: s, live }] : [];
  const above = live.roi >= rule.threshold;
  const before = d.memory.get(rule.id);
  d.memory.set(rule.id, above);
  const crossed = typeof before === "boolean" ? before !== above : above;   // first look: fire only when already above
  return crossed ? [{ market: m, side: s, live }] : [];
}

/** F10 "settled": markets a rule watches. One market when the rule names it; otherwise every market the user has any
 *  other alert rule on, plus My list (the same set "closing soon" uses). Capped so one rule can't fan out. */
function settledIds(rule: AlertRule, all: AlertRule[], listed: string[]): string[] {
  if (rule.market_id) return [rule.market_id];
  const own = all.filter((r) => r.enabled && r.kind !== "settled" && r.kind !== "big_trade" && r.market_id).map((r) => r.market_id!);
  return [...new Set([...own, ...listed])].slice(0, 20);
}

/** Settled payload: what happened, in plain words (no "bet this", no cents). */
function settledPayload(rule: AlertRule, m: Market | null, winner: 0 | 1 | null) {
  const won = winner === null ? null : (m?.sides[winner]?.outcome ?? (winner === 0 ? "Yes" : "No"));
  const message = won ? `Settled · ${won} won` : "Settled · no winner (the market was voided)";
  return { title: m ? title(m) : rule.name, message, rule_name: rule.name, kind: rule.kind };
}

/** F16 threshold: one trade worth this much or more (source and detail: lib/bigtrade.ts). Here, not there, so the browser
 *  bundle that imports this file never pulls in lib/bigtrade.ts's zod. */
export const BIG_TRADE_USD = 10_000;
/** The cron runs once a day; look back a little more than that. Dedupe (rule + transaction) makes the overlap harmless. */
export const BIG_TRADE_LOOKBACK_H = 25;
const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** F16: trades of $10,000+ on the markets a "big_trade" rule watches (same set as "settled"). One hit per trade. */
async function bigTradeHits(rule: AlertRule, d: Deps, all: AlertRule[], now: Date) {
  if (!d.fetchBigTrades) return [];
  const listed = rule.market_id ? [] : (await d.repo.watchlist.list()).map((w) => w.market_id);
  const markets = (await Promise.all(settledIds(rule, all, listed).map((id) => d.fetchMarket(id).catch(() => null))))
    .filter((m): m is Market => !!m);   // a market that left the live data has nothing left to follow
  if (!markets.length) return [];
  const since = Math.floor(now.getTime() / 1000) - BIG_TRADE_LOOKBACK_H * 3600;
  const trades = await d.fetchBigTrades([...new Set(markets.map((m) => m.event_id))], since);
  const hits: { market: Market; side: Side; trade: BigTrade }[] = [];
  for (const t of [...trades].sort((a, b) => b.ts - a.ts)) {   // newest first, so the cap below keeps the newest
    if (t.usd < BIG_TRADE_USD || t.ts < since) continue;
    const m = markets.find((x) => x.tokens.includes(t.token_id));
    if (!m) continue;
    const idx = m.tokens.indexOf(t.token_id) as 0 | 1;
    hits.push({ market: m, side: m.sides[idx] ?? m.best, trade: t });
  }
  return hits;
}

/** Evaluate enabled rules once. Returns the events it inserted (dedupe_key unique per cooldown bucket). */
export async function runRules(rules: AlertRule[], d: Deps): Promise<AlertEvent[]> {
  const now = d.now ?? new Date();
  const out: AlertEvent[] = [];
  const tradesSent = new Set<string>();   // F16: one alert per trade per user, even when two of their rules match it
  for (const rule of rules) {
    if (!rule.enabled || (d.kinds && !d.kinds.includes(rule.kind)) || inQuietHours(rule, now, d.timeZone)) continue;
    let fired = false;
    if (rule.kind === "settled") {
      // once per rule and market, ever: a resolved market never reopens, so no cooldown bucket in the key
      try {
        if (!d.fetchSettlement) continue;
        const ids = settledIds(rule, rules, rule.market_id ? [] : (await d.repo.watchlist.list()).map((w) => w.market_id));
        for (const id of ids) {
          const st = await d.fetchSettlement(id).catch(() => null);
          if (!st?.resolved) continue;
          const m = await d.fetchMarket(id).catch(() => null);
          try {
            out.push(await d.repo.alert_events.insert({
              rule_id: rule.id, market_id: id, side_index: st.winner_side_index,
              payload: settledPayload(rule, m, st.winner_side_index),
              sent_channels: ["in_app", ...(rule.channels.includes("push") ? ["push"] : [])],
              read_at: null, dedupe_key: `${rule.id}|${id}|settled`,
            }));
            fired = true;
          } catch (e) {
            if (!(e instanceof UniqueViolation)) throw e;
          }
        }
      } catch { continue; }
      if (fired) await d.repo.alert_rules.update(rule.id, { last_fired_at: now.toISOString() });
      continue;
    }
    if (rule.kind === "big_trade") {
      try {
        let n = 0;
        for (const h of await bigTradeHits(rule, d, rules, now)) {
          const t = h.trade;
          const key = `${t.tx}|${t.token_id}`;
          if (tradesSent.has(key)) continue;
          if (n >= 10) break;   // same cap as the other kinds
          tradesSent.add(key);
          n++;
          try {
            out.push(await d.repo.alert_events.insert({
              rule_id: rule.id, market_id: h.market.id, side_index: h.side.side_index,
              payload: {
                title: title(h.market), rule_name: rule.name, kind: rule.kind,
                message: `A ${usd0(t.usd)} ${t.side === "SELL" ? "sale" : "buy"} on ${h.side.outcome} at ${pct(t.price)}. Large trades are public; they are not a tip.`,
              },
              sent_channels: ["in_app", ...(rule.channels.includes("push") ? ["push"] : [])],
              // per user, not per rule: a second rule of theirs on the same trade hits this key and sends nothing
              read_at: null, dedupe_key: `bt|${d.owner ?? rule.id}|${t.tx}|${t.token_id}`,
            }));
            fired = true;
          } catch (e) {
            if (!(e instanceof UniqueViolation)) throw e;
          }
        }
      } catch { continue; }
      if (fired) await d.repo.alert_rules.update(rule.id, { last_fired_at: now.toISOString() });
      continue;
    }
    let hits: Hit[];
    try { hits = await candidates(rule, d); } catch { continue; }   // one bad rule never blocks the rest
    for (const h of hits.slice(0, 10)) {
      try {
        out.push(await d.repo.alert_events.insert({
          rule_id: rule.id, market_id: h.market.id, side_index: h.side.side_index,
          payload: { title: title(h.market), message: message(h.market, h.side, d.timeZone, h.live, d.odds), rule_name: rule.name, kind: rule.kind },
          sent_channels: ["in_app", ...(rule.channels.includes("push") ? ["push"] : [])],
          read_at: null, dedupe_key: dedupeKey(rule, h.market.id, h.side.side_index, now),
        }));
        fired = true;
      } catch (e) {
        if (!(e instanceof UniqueViolation)) throw e;   // already sent within the cooldown
      }
    }
    if (fired) await d.repo.alert_rules.update(rule.id, { last_fired_at: now.toISOString() });
  }
  return out;
}
