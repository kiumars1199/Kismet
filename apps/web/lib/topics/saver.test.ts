// T-wt2j: the saver's pending list (what a pagehide flush sends) is the confirmed list plus every unconfirmed tap, queued or in flight.
import { describe, expect, it, vi } from "vitest";
import { createTopicSaver } from "./saver";

describe("createTopicSaver.pending", () => {
  it("is null when idle, the full unconfirmed list while saves are queued or in flight, null again once confirmed", async () => {
    vi.useFakeTimers();
    let server: string[] = ["nfl"];
    const s = createTopicSaver({
      isReady: () => true, ready: async () => {}, current: () => server,
      save: async (n) => { await new Promise((r) => setTimeout(r, 200)); server = n; }, onLocal: () => {},
    });
    expect(s.pending()).toBeNull();
    s.toggle("nba"); s.toggle("soccer");
    expect(s.pending()).toEqual(["nfl", "nba", "soccer"]);
    await vi.advanceTimersByTimeAsync(100);
    expect(s.pending()).toEqual(["nfl", "nba", "soccer"]);   // in flight
    await vi.advanceTimersByTimeAsync(1_000);
    await s.idle();
    expect(server).toEqual(["nfl", "nba", "soccer"]);
    expect(s.pending()).toBeNull();
    vi.useRealTimers();
  });

  it("freeze: returns the full unconfirmed list, a request cut off afterwards does not drop the taps, resume sends them again", async () => {
    vi.useFakeTimers();
    let server: string[] = [];
    let cut = true;
    const saves: string[][] = [];
    const s = createTopicSaver({
      isReady: () => true, ready: async () => {}, current: () => server,
      save: async (n) => { saves.push(n); await new Promise((r) => setTimeout(r, 200)); if (cut) throw new Error("aborted"); server = n; }, onLocal: () => {},
    });
    s.toggle("a"); s.toggle("b");
    await vi.advanceTimersByTimeAsync(50);
    expect(s.freeze()).toEqual(["a", "b"]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(saves).toEqual([["a", "b"]]);   // nothing more is sent while frozen
    expect(s.pending()).toEqual(["a", "b"]);   // and the cut-off request did not drop them
    cut = false;
    s.resume();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(server).toEqual(["a", "b"]);
    vi.useRealTimers();
  });

  it("a network-level failure is retried once before it counts; an HTTP error is not", async () => {
    vi.useFakeTimers();
    let server: string[] = [];
    let calls = 0;
    const errors: string[][] = [];
    const s = createTopicSaver({
      isReady: () => true, ready: async () => {}, current: () => server,
      save: async (n) => { calls++; if (calls === 1) throw new TypeError("Failed to fetch"); if (calls === 2) throw new Error("HTTP 500"); server = n; },
      onLocal: () => {}, onError: (d) => errors.push(d),
    });
    s.toggle("a");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(2);   // fetch failure, retried once, the retry got an HTTP 500
    expect(errors).toEqual([["a"]]);
    vi.useRealTimers();
  });
});
