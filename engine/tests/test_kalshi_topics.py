"""F3: every open Kalshi series maps to a topic id that exists in apps/web/lib/taxonomy.ts.
kalshi_series.json is a hand-built list of real-looking series tickers (not a live crawl); taxonomy_ids.json mirrors
Object.keys(TAXONOMY) and is kept in sync by apps/web/test/taxonomy-ids.test.ts."""
import json
import os

from engine.kalshi_topics import topic_of

FIX = os.path.join(os.path.dirname(__file__), "fixtures")
SERIES = json.load(open(os.path.join(FIX, "kalshi_series.json")))
IDS = set(json.load(open(os.path.join(FIX, "taxonomy_ids.json"))))


def specific(t):
    return t != "other" and not t.endswith(".other")


def test_fixture_is_big_enough():
    assert len(SERIES) >= 100


def test_every_topic_exists_in_taxonomy():
    bad = [(s["series"], topic_of(s["series"], s["title"])) for s in SERIES if topic_of(s["series"], s["title"]) not in IDS]
    assert not bad, bad


def test_at_least_95_percent_map_to_a_non_other_topic():
    # SPEC F3: not the catch-all "other". A known category's own "<cat>.other" bucket (e.g. crypto.other) counts.
    hits = sum(topic_of(s["series"], s["title"]) != "other" for s in SERIES)
    assert hits / len(SERIES) >= 0.95, f"{hits}/{len(SERIES)}"


def test_at_least_90_percent_get_a_specific_topic():
    hits = sum(specific(topic_of(s["series"], s["title"])) for s in SERIES)
    assert hits / len(SERIES) >= 0.90, f"{hits}/{len(SERIES)}"


def test_known_series():
    assert topic_of("KXNFLGAME-26NOV20INDHOU") == "sports.nfl"
    assert topic_of("KXHIGHNY") == "weather.highest-temperature"
    assert topic_of("KXBTCD") == "crypto.bitcoin"
    assert topic_of("KXNEWTHING", "Will the Senate pass a bill") == "politics.elections"
    assert topic_of("KXQQQ", "nothing") == "other"


def test_keyword_fallback_matches_whole_words_only():
    # substrings that used to misfire: rain in Ukraine, snow in Snowden, gold in Golden, war in Warriors
    assert topic_of("KXQ1", "Will Snowden be pardoned?") == "other"
    assert topic_of("KXQ2", "Will Ukraine and Russia sign a ceasefire?") == "geopolitics"
    assert topic_of("KXQ3", "Golden State Warriors win the title") != "finance.commodities"
    assert topic_of("KXQ3", "Golden State Warriors win the title") != "geopolitics"
    assert topic_of("KXQ4", "Golden Globe Best Drama") != "finance.commodities"
    assert topic_of("KXQ5", "Gold above 3000 on Dec 31") == "finance.commodities"
    assert topic_of("KXQ6", "Will it rain in Seattle?") == "weather.precipitation"
    assert topic_of("KXQ6", "Will it rains again") == "weather.precipitation"
    assert topic_of("KXQ7", "War in Taiwan by June") == "geopolitics"
    assert topic_of("KXQ8", "Brain scan startup raises money") == "other"   # brain is not rain
    assert topic_of("KXQ9", "Warriors at Lakers") != "geopolitics"


def test_short_prefixes_no_longer_swallow_other_series():
    assert topic_of("KXSOLAR", "Solar capacity added this year") == "other"       # was crypto.solana (SOL prefix)
    assert topic_of("KXGOVSHUT", "Government shutdown before January") == "politics.congress"   # was politics.elections (GOV)
    assert topic_of("KXSOLD", "Solana price today") == "crypto.solana"
    assert topic_of("KXGOVPARTYCA", "California governor party") == "politics.elections"
    assert topic_of("KXWARRIORS", "Warriors at Lakers") != "geopolitics"


def test_fixture_has_series_that_only_the_keyword_fallback_can_place():
    from engine import kalshi_topics as k
    prefixes = [p for p, _ in k.SERIES]
    missed = [x for x in SERIES if not any(x["series"].upper()[2:].startswith(p) for p in prefixes)]
    assert len(missed) >= 10
    assert all(topic_of(x["series"], x["title"]) in IDS for x in missed)
    assert sum(topic_of(x["series"], x["title"]) != "other" for x in missed) >= 0.9 * len(missed)
