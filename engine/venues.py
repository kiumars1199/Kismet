"""F4: the same outcome on every venue. For each scanned Polymarket market, `venues` lists its price on Polymarket,
on Polymarket US (the scan's own `us` match) and on Kalshi (matched here), for the SAME side the scan calls `best`.

Written to output/venues.json ({market_id: {venues, kalshi_ticker?, kalshi_match_conf?}}), only for markets listed on at
least two venues. It is a side file because the Kalshi crawl runs after the scan is published (engine/__main__.py
`kalshi`), so markets.json can't carry Kalshi prices; the web merges it into the store by id.

Kalshi matching is conservative: precision over recall. A pair must pass hard gates (same category family, closes within
48 h, same numbers, the side's name appears in Kalshi's label) and then a score >= MIN_SCORE. No match = "Not listed".

Kalshi multiplier (Nov 23, 2026): Kalshi's published taker fee, fee = round_up_to_cent(0.07 x C x P x (1 - P)), from
https://kalshi.com/docs/kalshi-fee-schedule.pdf (found by web search on 2026-11-23; docs/launch/decisions.md). For one
fixed reference order, a $100 stake (C = floor(100 / P) contracts, the same for everyone), the total fee is rounded up to the
cent, the per-contract fee is that total / C, and the multiplier is 1 / (P + per-contract fee). (Worked for one contract the
rounding inflated longshots: 1% showed 50x where a $100 order gives about 93.5x.) This is Kalshi's STANDARD fee: some Kalshi
markets use a different fee multiplier, so the web labels it "for a $100 bet, standard Kalshi fee", never "exact".
"""
import bisect
import json
import math
import os
import re
import time

MIN_SCORE = 0.9
MAX_CLOSE_GAP_S = 48 * 3600
STOP = {"the", "a", "an", "of", "vs", "v", "at", "will", "be", "to", "in", "on", "by", "or", "and", "for", "who", "win",
        "wins", "winner", "game", "match", "which", "what", "is", "are"}


def tokens(s):
    return [t for t in re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", (s or "").lower().replace("'", "")) if t not in STOP]


def numbers(s):
    return {t for t in tokens(s) if re.fullmatch(r"\d+(\.\d+)?", t)}


def _jaccard(a, b):
    a, b = set(a), set(b)
    return len(a & b) / len(a | b) if a | b else 0.0


def kalshi_url(series):
    return f"https://kalshi.com/markets/{(series or '').lower()}"


def score(pm, k):
    """0..1 that Kalshi row `k` (a dict with ticker, title, subtitle, topic, series, yes_bid, yes_ask, close_epoch) is the
    same outcome as the best side of Polymarket market `pm`. 0 when a hard gate fails."""
    if not k["close_epoch"] or not pm.get("closes_at"):
        return 0.0
    gap = abs(k["close_epoch"] - pm["closes_at"])
    if gap > MAX_CLOSE_GAP_S:
        return 0.0
    top = (k["topic"] or "other").split(".")[0]
    if top not in ("other", pm.get("category")):
        return 0.0
    pm_text = f'{pm.get("event") or ""} {pm.get("question") or ""}'
    k_text = f'{k["title"]} {k["subtitle"]}'
    outcome = pm["best"]["outcome"]
    yes_no = outcome.lower() in ("yes", "no")
    nums_pm, nums_k = numbers(pm_text + " " + ("" if yes_no else outcome)), numbers(k_text)
    if nums_pm != nums_k:   # a different line, strike or date is a different bet
        return 0.0
    k_tokens = set(tokens(k_text))
    label = set(tokens(k["subtitle"])) or k_tokens   # Kalshi's Yes label is the named side; the title has both teams
    if not yes_no and not set(tokens(outcome)) <= label:
        return 0.0
    # A Yes/No market names its subject in the question, not in the outcome: what the question adds to the event title
    # ("Anora" in "Best Picture winner: Anora") must be in Kalshi's label too.
    if yes_no and not (set(tokens(pm.get("question"))) - set(tokens(pm.get("event")))) <= k_tokens:
        return 0.0
    title_sim = max(_jaccard(tokens(pm.get("event")), tokens(k["title"])), _jaccard(tokens(pm.get("question")), tokens(k["title"])))
    return round(0.7 * title_sim + 0.2 + 0.1 * (1 - gap / MAX_CLOSE_GAP_S), 4)


def kalshi_rows(tuples):
    """kalshi_index.json rows (INDEX_COLUMNS order) -> dicts."""
    return [dict(ticker=t[0], title=t[1], subtitle=t[2], topic=t[3], series=t[4], yes_bid=t[5], yes_ask=t[6],
                 close_epoch=t[9]) for t in tuples]


def match_kalshi(pm, rows):
    """(row, score) of the best Kalshi row at or above MIN_SCORE, else None."""
    best = None
    for k in rows:
        s = score(pm, k)
        if s >= MIN_SCORE and (best is None or s > best[1]):
            best = (k, s)
    return best


# --- the indexed matcher (T-hot1) ---------------------------------------------------------------------------------------------
# The pairwise loop above (match_kalshi) is the reference: it scored every Kalshi row for every Polymarket market, ~15K x 183K
# calls, ~82 minutes in prod. KalshiIndex returns exactly the same match without the scan.
#
# Why a token index can be exact. score() is  round(0.7 * title_sim + 0.2 + 0.1 * (1 - gap / MAX_CLOSE_GAP_S), 4)  after hard gates
# that only return 0 (close time, category, numbers, side name, subject words). The only terms that add anything are title_sim
# (a Jaccard, 0..1), a constant 0.2, and 0.1 * (1 - gap / MAX) with 0 <= gap <= MAX (a larger gap is a gate -> 0), so that term is
# in [0, 0.1]. For score >= MIN_SCORE = 0.9 after rounding to 4 places we need  0.7 * sim + 0.3 >= 0.89995, i.e.
# sim >= 0.857071...; MIN_SIM below is 0.857, a hair lower, so we can only over-include candidates, never miss one. Gates only
# remove candidates, so they cannot break the bound; the real score() still runs on every candidate and decides.
#
# sim = max(J(event, title), J(question, title)) over token SETS. Jaccard(A, B) >= t  =>  |A & B| >= t * |A | B| >= t * |A|, so B holds at
# least need = ceil(t * |A|) of A's tokens and misses at most |A| - need. Any |A| - need + 1 tokens of A therefore include one that B
# holds (pigeonhole): index Kalshi titles by token, look up the rarest |A| - need + 1 tokens of each Polymarket variant, and the union
# of those posting lists contains every row that can reach MIN_SCORE. Candidates are scored in original row order with the same strict
# '>' as the loop, so ties still go to the first row.
MIN_SIM = 0.857


class BudgetExceeded(Exception):
    """The matcher ran past its wall-clock budget (checked inside the loops, never a background thread)."""


class KalshiIndex:
    """Token postings per Kalshi title, each posting list sorted by close time (rows without a close time can never score, so they are
    left out), so a lookup is: rarest prefix tokens -> the rows in the +-48 h window -> the title-size window -> score()."""

    def __init__(self, rows, deadline=None):
        self.rows = rows
        self.ntok = [0] * len(rows)
        post = {}
        order = sorted((i for i, k in enumerate(rows) if k["close_epoch"]), key=lambda i: (rows[i]["close_epoch"], i))
        for n, i in enumerate(order):
            if deadline is not None and n % 4096 == 0 and time.monotonic() > deadline:
                raise BudgetExceeded("indexing")
            toks = set(tokens(rows[i]["title"]))
            self.ntok[i] = len(toks)
            e = rows[i]["close_epoch"]
            for t in toks:
                lst = post.get(t)
                if lst is None:
                    post[t] = lst = ([], [])
                lst[0].append(e)
                lst[1].append(i)
        self.post = post

    def _variants(self, pm):
        out = []
        for text in (pm.get("event"), pm.get("question")):
            a = set(tokens(text))
            if a:   # an empty side has Jaccard 0 with everything
                need = math.ceil(MIN_SIM * len(a) - 1e-9)
                out.append((a, need, math.floor(len(a) / MIN_SIM + 1e-9)))   # tokens needed in common; largest title that can still reach MIN_SIM
        return out

    def match(self, pm):
        """(row, score) exactly as match_kalshi(pm, rows), else None."""
        c = pm.get("closes_at")
        if not c:
            return None   # score() is 0 without a close time
        variants = self._variants(pm)
        cand = set()
        for a, need, _ in variants:
            take = len(a) - need + 1
            # the `take` rarest tokens of A; a token no row holds is the rarest of all (it fills a slot and finds nothing)
            prefix = sorted(a, key=lambda t: len(self.post[t][0]) if t in self.post else 0)[:take]
            lists = [self.post[t] for t in prefix if t in self.post]
            for times, idx in lists:
                lo, hi = bisect.bisect_left(times, c - MAX_CLOSE_GAP_S), bisect.bisect_right(times, c + MAX_CLOSE_GAP_S)
                cand.update(idx[lo:hi])
        best, best_i = None, None
        for i in cand:
            n = self.ntok[i]
            if not any(need <= n <= hi for _, need, hi in variants):   # Jaccard >= t needs t|A| <= |B| <= |A| / t
                continue
            k = self.rows[i]
            s = score(pm, k)
            if s >= MIN_SCORE and (best is None or s > best[1] or (s == best[1] and i < best_i)):   # ties go to the first row, as in the loop
                best, best_i = (k, s), i
        return best


def kalshi_price(pm, k):
    """Price (0-1) of the SAME side on Kalshi: the Yes ask, or for a "No" side what No costs (1 - the Yes bid)."""
    if pm["best"]["outcome"].lower() == "no":
        return None if k["yes_bid"] is None else round(1 - k["yes_bid"] / 100, 4)
    return None if k["yes_ask"] is None else round(k["yes_ask"] / 100, 4)


REFERENCE_STAKE = 100   # dollars: the one order every Kalshi multiplier is worked for (the same for everyone, nothing personalised)


def kalshi_contracts(price):
    """Contracts a $100 order buys at `price` (0-1): floor(100 / P), in integer cents."""
    return REFERENCE_STAKE * 100 // round(price * 100)


def kalshi_fee_total(price):
    """Standard Kalshi taker fee in dollars for the $100 reference order: 0.07 * C * P * (1 - P) rounded UP to the cent
    (integer cents, so float noise cannot add a cent). See the module doc for the source."""
    p = round(price * 100)
    c = kalshi_contracts(price)
    return -(-7 * c * p * (100 - p) // 10000) / 100


def kalshi_multiplier(price):
    """1 / (P + per-contract fee) for the $100 reference order (per-contract fee = total fee / contracts, so a longshot is
    not inflated by rounding one contract's fee up to a cent), or None without a usable price."""
    if not price or price <= 0:
        return None
    return round(1 / (price + kalshi_fee_total(price) / kalshi_contracts(price)), 4)


def _mult(ask, fee):
    return round(1 / (ask + (fee or 0)), 4) if ask and ask > 0 else None


def quotes(pm, rows, index=None):
    """-> (venues, kalshi_match). venues in a fixed order: polymarket, us, kalshi (absent = not listed). `index`: a KalshiIndex over
    `rows` (the same answer as scanning `rows`, without the scan)."""
    b = pm["best"]
    out = [dict(venue="polymarket", price=b["ask"], multiplier=_mult(b["ask"], b.get("fee")), url=pm["url"])]
    us = pm.get("us")
    if us:
        out.append(dict(venue="us", price=us.get("ask"), multiplier=_mult(us.get("ask"), us.get("fee")), url=us["url"]))
    hit = (index.match(pm) if index is not None else match_kalshi(pm, rows)) if rows else None
    if hit:
        k, s = hit
        out.append(dict(venue="kalshi", price=kalshi_price(pm, k), multiplier=kalshi_multiplier(kalshi_price(pm, k)), url=kalshi_url(k["series"])))
    return out, hit


def build(markets, tuples, deadline=None):
    """deadline: time.monotonic() value after which BudgetExceeded is raised (checked every 64 markets and while indexing)."""
    rows = kalshi_rows(tuples or [])
    index = KalshiIndex(rows, deadline) if rows else None
    res = {}
    for n, pm in enumerate(markets):
        if deadline is not None and n % 64 == 0 and time.monotonic() > deadline:
            raise BudgetExceeded("matching")
        if pm.get("venue") == "us":   # US-native rows are priced on US only
            continue
        venues, hit = quotes(pm, rows, index)
        if len(venues) < 2:
            continue
        res[pm["id"]] = dict(venues=venues, side=pm["best"].get("side_index"))
        if hit:
            res[pm["id"]].update(kalshi_ticker=hit[0]["ticker"], kalshi_match_conf=hit[1])
    return res


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


KEEP_PREV = 2   # older snapshots kept in venues.json (the web's delayed stores read them)


BUDGET_S = 150   # the matcher gets 2.5 minutes of a scan cycle; on overrun the previous venues.json stays


def write(cfg, log=print, budget_s=BUDGET_S):
    """output/venues.json from output/markets.json and (when present) output/kalshi_index.json.

    Kalshi quotes are only as new as the crawl (meta.kalshi_fetched_at), and Free's store is a scan or more behind, so the
    file also keeps the last KEEP_PREV snapshots of itself in `prev` (newest first): the web takes the newest snapshot whose
    crawl is not newer than the store's own scan, so Free never sees a fresher Kalshi price than its scan."""
    out = cfg.path("output", "venues.json")
    markets = (_read(cfg.path("output", "markets.json")) or {}).get("markets") or []
    ix = _read(cfg.path("output", "kalshi_index.json"))
    try:
        res = build(markets, (ix or {}).get("rows"), time.monotonic() + budget_s)
    except BudgetExceeded as e:
        # never hold up the scan loop: keep what is on disk (the web reads it as is) and say so once
        old = _read(out) or {}
        log(f"[venues] WARNING time budget of {budget_s:g}s used while {e}; keeping the previous venues.json ({len(old.get('venues') or {})} markets)")
        return old.get("venues") or {}
    fetched = int(((ix or {}).get("meta") or {}).get("fetched_at") or 0) or None
    meta = {"n": len(res), "kalshi": bool(ix), "generated_at": int(time.time())}
    if fetched:
        meta["kalshi_fetched_at"] = fetched
    old = _read(out) or {}
    snaps = [{"meta": old["meta"], "venues": old["venues"]}] if old.get("meta") and isinstance(old.get("venues"), dict) else []
    snaps += [x for x in old.get("prev") or [] if isinstance(x, dict) and x.get("meta")]
    seen, prev = {fetched}, []
    for x in snaps:
        k = x["meta"].get("kalshi_fetched_at")
        if k is not None and k not in seen and len(prev) < KEEP_PREV:
            seen.add(k)
            prev.append({"meta": x["meta"], "venues": x["venues"]})
    tmp = out + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"meta": meta, "venues": res, "prev": prev}, f, separators=(",", ":"))
    os.replace(tmp, out)
    log(f"[venues] {len(res)} markets on 2+ venues (kalshi index {'used' if ix else 'absent'}), {len(prev)} older snapshots kept")
    return res
