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
