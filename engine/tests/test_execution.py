"""Execution check must reproduce the recorded fixture (also the contract for the TS port)."""
import json
import os

from engine.execution import check

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "book_expected.json")


def test_fixture_matches():
    for case in json.load(open(FIX)):
        got = check(case["q"], case["book"], case["fee_rate"], case["min_edge"])
        assert got == case["expected"]


def test_wide_spread_is_not_worth_it():
    book = {"bids": [{"price": "0.40", "size": "100"}], "asks": [{"price": "0.62", "size": "100"}]}
    assert check(0.6, book, 0.05, 0.02)["verdict"] == "not worth it"
