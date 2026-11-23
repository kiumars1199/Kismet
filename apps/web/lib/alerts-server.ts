// Server alerts evaluator for the /api/alerts/run cron (docs/05 F-11, docs/10 T-45). Server only: uses the
// service-role client. Same rule logic as the demo tab (lib/alerts.ts runRules); this adds per-user tier,
// timezone and quiet hours, and delivery. Insert happens before any send and dedupe_key is unique, so a
// second run in the same cooldown bucket inserts nothing and sends nothing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { liveRoi, runRules, type Deps } from "@/lib/alerts";
import { pushConfigured, sendPush, type PushSub } from "@/lib/alerts-push";
import { sendEmail, siteUrl, unsubscribeUrl } from "@/lib/email";
import { alertEmail, DISCLAIMER } from "@/lib/email/templates";
import { can, effectiveTier, type Tier } from "@/lib/entitlements";
import { UniqueViolation, type AlertEvent, type AlertKind, type AlertRule, type OddsFormat, type Repo } from "@/lib/repo/types";

type Row = AlertRule & { user_id: string };
export type Source = Pick<Deps, "fetchMarkets" | "fetchMarket" | "fetchBook" | "fetchSettlement" | "fetchBigTrades">;
export interface RunCounts { users: number; rules: number; events: number; emails: number; webhooks: number; pushes: number; errors: number }

// docs/15: webhooks only to these prefixes (same as the alert_rules schema), checked again after URL normalization
const HOOKS = { discord: "https://discord.com/api/webhooks/", telegram: "https://api.telegram.org/" } as const;
export function webhookUrl(ch: keyof typeof HOOKS, raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.href.startsWith(HOOKS[ch]) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

// ponytail: Telegram's chat_id must be in the saved URL's query (…/sendMessage?chat_id=…); add a chat_id field if users trip on it.
async function postHook(ch: keyof typeof HOOKS, url: string, text: string): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ch === "discord" ? { content: text.slice(0, 2000) } : { text: text.slice(0, 4096) }),
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  return res.ok;
}

const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
};

/** One trade-feed request per distinct event set per run, shared by every Premium user in it. */
const memoTrades = (f: NonNullable<Source["fetchBigTrades"]>): NonNullable<Source["fetchBigTrades"]> => {
  const seen = new Map<string, ReturnType<typeof f>>();
  return (ids, since) => {
    const k = `${since}|${[...new Set(ids)].sort().join(",")}`;
    if (!seen.has(k)) seen.set(k, f(ids, since));
    return seen.get(k)!;
  };
};

/** ?kind= on /api/alerts/run. None: every kind (the daily cron). "bigtrade": only big-trade rules (refresh.yml, after
 *  every scan, so a big trade is alerted within one scan). Anything else: null, and the route answers 400. */
export function kindsFromQuery(url: string): AlertKind[] | undefined | null {
  const k = new URL(url).searchParams.get("kind");
  if (k === null) return undefined;
  return k === "bigtrade" ? ["big_trade"] : null;
}

export async function runServerAlerts(db: SupabaseClient, src: Source, now = new Date(), opts: { kinds?: AlertKind[] } = {}): Promise<RunCounts> {
  const all = must<Row[]>(await db.from("alert_rules").select("*").eq("enabled", true), "alert_rules read") ?? [];
  const counts: RunCounts = { users: 0, rules: 0, events: 0, emails: 0, webhooks: 0, pushes: 0, errors: 0 };
  const runs = (r: Row) => !opts.kinds || opts.kinds.includes(r.kind);
  // users with nothing to evaluate in this run are skipped; their other rules stay in as context
  const rules = all.filter((r) => all.some((x) => x.user_id === r.user_id && runs(x)));
  if (!rules.length) return counts;
  const bigTrades = src.fetchBigTrades ? memoTrades(src.fetchBigTrades) : undefined;
  const users = [...new Set(rules.map((r) => r.user_id))];
  const profiles = must<{ user_id: string; timezone: string | null; odds_format: OddsFormat | null }[]>(
    await db.from("profiles").select("user_id, timezone, odds_format").in("user_id", users), "profiles read") ?? [];
  // "*": tier plus the admin comp columns (T-140) when the migration has run
  const subs = must<{ user_id: string; tier: string; comp_tier?: string | null; comp_expires_at?: string | null }[]>(
    await db.from("subscriptions").select("*").in("user_id", users), "subscriptions read") ?? [];
  // preset_match "new market" memory survives serverless runs as the rule's past events.
  // ponytail: last 5000 events across preset rules; a seen-keys column if rules match more than that.
  const presetIds = rules.filter((r) => r.kind === "preset_match").map((r) => r.id);
  const seen = presetIds.length ? must<{ rule_id: string; market_id: string; side_index: number | null }[]>(
    await db.from("alert_events").select("rule_id, market_id, side_index").in("rule_id", presetIds)
      .order("fired_at", { ascending: false }).limit(5000), "alert_events read") ?? [] : [];

  for (const uid of users) {
    const tier: Tier = effectiveTier(subs.find((s) => s.user_id === uid), now.getTime());
    if (!can(tier, "alerts")) continue;   // lapsed plan: rules stay stored but never fire
    const mine = rules.filter((r) => r.user_id === uid);
    const prof = profiles.find((p) => p.user_id === uid);
    const timeZone = prof?.timezone || "America/New_York";
    const memory: Deps["memory"] = new Map();
    for (const r of mine.filter((x) => x.kind === "preset_match"))
      memory.set(r.id, new Set(seen.filter((e) => e.rule_id === r.id).map((e) => `${e.market_id}|${e.side_index}`)));
    // ponytail: edge_change has no stored above/below state, so while above it fires once per cooldown bucket.
    const live = new Map<string, { ask: number; roi: number }>();
    const repo = {
      alert_events: {
        insert: async (row: Omit<AlertEvent, "id" | "fired_at">) => {
          const r = await db.from("alert_events").insert({ ...row, user_id: uid }).select().single();
          if (r.error?.code === "23505") throw new UniqueViolation("alert_events");
          return must<AlertEvent>(r, "alert_events insert");
        },
      },
      alert_rules: {
        update: async (id: string, patch: Partial<AlertRule>) => {
          must(await db.from("alert_rules").update(patch).eq("id", id).eq("user_id", uid), "alert_rules update");
          return null;
        },
      },
      watchlist: {
        list: async () => must<{ market_id: string }[]>(
          await db.from("watchlist").select("market_id").eq("user_id", uid), "watchlist read") ?? [],
      },
    } as unknown as Repo;
    const deps: Deps = {
      ...src, repo, now, timeZone, odds: prof?.odds_format ?? "percent", memory, kinds: opts.kinds, owner: uid,
      // F16: Premium only. Free and Pro get no feed, so a big_trade rule on those plans can never fire.
      fetchBigTrades: tier === "premium" ? bigTrades : undefined,
      fetchBook: async (token, q, cat) => {
        const x = await src.fetchBook(token, q, cat);
        if (x) live.set(token, { ask: x.best_ask, roi: liveRoi(x) });
        return x;
      },
    };

    counts.users++;
    counts.rules += mine.filter(runs).length;
    let events: AlertEvent[];
    try { events = await runRules(mine, deps); } catch (e) {
      console.error("[alerts/run] user failed:", (e as Error).message);
      counts.errors++;
      continue;
    }
    counts.events += events.length;
    let email: string | null | undefined;
    // F10: this user's devices, read once and only when a fired rule asks for push on a plan that has it.
    // Only events inserted this run get here (dedupe_key is unique), so each event is pushed at most once.
    let devices: (PushSub & { id: string })[] = [];
    const wantsPush = pushConfigured() && can(tier, "push") && events.some((e) => mine.find((r) => r.id === e.rule_id)?.channels.includes("push"));
    if (wantsPush) {
      const r = await db.from("push_subscriptions").select("id, endpoint, keys").eq("user_id", uid);
      if (r.error) counts.errors++;
      devices = (r.data ?? []) as (PushSub & { id: string })[];
    }
    for (const ev of events) {
      const rule = mine.find((r) => r.id === ev.rule_id)!;
      const m = await src.fetchMarket(ev.market_id);
      const s = m && (m.sides[ev.side_index ?? m.best.side_index] ?? m.best);
      const sent = ["in_app"];
      try {
        if (m && s && rule.channels.includes("email")) {
          if (email === undefined) email = (await db.auth.admin.getUserById(uid)).data.user?.email ?? null;
          if (email) {
            const unsub = unsubscribeUrl(uid, rule.id);
            const r = await sendEmail(alertEmail({ to: email, ruleName: rule.name, market: m, side: s, timeZone,
              live: live.get(m.tokens[s.side_index] ?? ""), unsubscribeUrl: unsub }));
            if (r.sent) { sent.push("email"); counts.emails++; }
          }
        }
        if (m && can(tier, "webhooks")) {
          const p = ev.payload as { title?: string; message?: string } | null;
          const text = [p?.title, p?.message, `${siteUrl()}/m/${encodeURIComponent(m.id)}`, DISCLAIMER].filter(Boolean).join("\n");
          for (const ch of ["discord", "telegram"] as const) {
            const url = rule.channels.includes(ch) ? webhookUrl(ch, rule.webhook_url) : null;
            if (url && (await postHook(ch, url, text))) { sent.push(ch); counts.webhooks++; }
          }
        }
        if (devices.length && rule.channels.includes("push")) {
          const p = ev.payload as { title?: string; message?: string } | null;
          const body = { title: p?.title ?? rule.name, body: p?.message ?? "", url: `/m/${encodeURIComponent(ev.market_id)}` };
          let ok = false;
          for (const dev of [...devices]) {
            const res = await sendPush({ endpoint: dev.endpoint, keys: dev.keys }, body);
            if (res === "sent") ok = true;
            else if (res === "gone") {   // the push service forgot this device: drop it
              await db.from("push_subscriptions").delete().eq("id", dev.id).eq("user_id", uid);
              devices = devices.filter((x) => x.id !== dev.id);
            } else counts.errors++;
          }
          if (ok) { sent.push("push"); counts.pushes++; }
        }
      } catch (e) {
        console.error("[alerts/run] delivery failed:", (e as Error).message);   // event stays; never re-sent
        counts.errors++;
      }
      // record what actually went out: "push" only when a push service accepted it
      const u = await db.from("alert_events").update({ sent_channels: sent }).eq("id", ev.id);
      if (u.error) counts.errors++;
    }
  }
  return counts;
}
