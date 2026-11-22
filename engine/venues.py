"""F4: the same outcome on every venue. For each scanned Polymarket market, `venues` lists its price on Polymarket,
on Polymarket US (the scan's own `us` match) and on Kalshi (matched here), for the SAME side the scan calls `best`.

Written to output/venues.json ({market_id: {venues, kalshi_ticker?, kalshi_match_conf?}}), only for markets listed on at
least two venues. It is a side file because the Kalshi crawl runs after the scan is published (engine/__main__.py
`kalshi`), so markets.json can't carry Kalshi prices; the web merges it into the store by id.

Kalshi matching is conservative: precision over recall. A pair must pass hard gates (same category family, closes within
48 h, same numbers, the side's name appears in Kalshi's label) and then a score >= MIN_SCORE. No match = "Not listed".

Kalshi multiplier is None on purpose: Kalshi's fee formula is in its fee schedule PDF
(https://kalshi.com/docs/kalshi-fee-schedule.pdf, linked from https://help.kalshi.com/en/articles/13823805-fees), which
returned HTTP 429 on every fetch on 2026-11-22, and the help page itself carries no formula. TODO: read the formula from
that PDF and fill `multiplier`; until then Kalshi shows its price only and never wins "Pays most here".
"""
import json
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


def kalshi_price(pm, k):
    """Price (0-1) of the SAME side on Kalshi: the Yes ask, or for a "No" side what No costs (1 - the Yes bid)."""
    if pm["best"]["outcome"].lower() == "no":
        return None if k["yes_bid"] is None else round(1 - k["yes_bid"] / 100, 4)
    return None if k["yes_ask"] is None else round(k["yes_ask"] / 100, 4)


def _mult(ask, fee):
    return round(1 / (ask + (fee or 0)), 4) if ask and ask > 0 else None


def quotes(pm, rows):
    """-> (venues, kalshi_match). venues in a fixed order: polymarket, us, kalshi (absent = not listed)."""
    b = pm["best"]
    out = [dict(venue="polymarket", price=b["ask"], multiplier=_mult(b["ask"], b.get("fee")), url=pm["url"])]
    us = pm.get("us")
    if us:
        out.append(dict(venue="us", price=us.get("ask"), multiplier=_mult(us.get("ask"), us.get("fee")), url=us["url"]))
    hit = match_kalshi(pm, rows) if rows else None
    if hit:
        k, s = hit
        out.append(dict(venue="kalshi", price=kalshi_price(pm, k), multiplier=None, url=kalshi_url(k["series"])))   # TODO fee, see module doc
    return out, hit


def build(markets, tuples):
    rows = kalshi_rows(tuples or [])
    res = {}
    for pm in markets:
        if pm.get("venue") == "us":   # US-native rows are priced on US only
            continue
        venues, hit = quotes(pm, rows)
        if len(venues) < 2:
            continue
        res[pm["id"]] = dict(venues=venues)
        if hit:
            res[pm["id"]].update(kalshi_ticker=hit[0]["ticker"], kalshi_match_conf=hit[1])
    return res


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write(cfg, log=print):
    """output/venues.json from output/flags.json + markets.json and (when present) output/kalshi_index.json."""
    out = cfg.path("output", "venues.json")
    markets = (_read(cfg.path("output", "markets.json")) or {}).get("markets") or []
    ix = _read(cfg.path("output", "kalshi_index.json"))
    res = build(markets, (ix or {}).get("rows"))
    tmp = out + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"meta": {"n": len(res), "kalshi": bool(ix), "generated_at": int(time.time())}, "venues": res}, f, separators=(",", ":"))
    os.replace(tmp, out)
    log(f"[venues] {len(res)} markets on 2+ venues (kalshi index {'used' if ix else 'absent'})")
    return res
