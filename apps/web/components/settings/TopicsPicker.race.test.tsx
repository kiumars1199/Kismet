// @vitest-environment jsdom
// T-wt2j: quick taps keep every topic. The fake store behaves like SupabaseRepo on final: the snapshot only changes when the
// server answers, and answers come late and out of order. Three taps back to back must leave the server holding all three,
// and the tiles must show chosen at once.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let server: string[] = [];
let confirmed: string[] = [];
const writes: string[][] = [];
const delays = [300, 50, 150, 100, 100, 100];   // later saves can land before earlier ones if they were allowed to overlap
let n = 0;
const listeners = new Set<() => void>();
const fail = { on: false };

const patch = vi.fn(async (p: { favorite_topics?: string[] }) => {
  const mine = n++;
  writes.push(p.favorite_topics ?? []);
  await new Promise((r) => setTimeout(r, delays[mine % delays.length]));
  if (fail.on) throw new Error("save failed");
  if (p.favorite_topics) { server = p.favorite_topics; confirmed = p.favorite_topics; }
  listeners.forEach((l) => l());
  return {};
});
vi.mock("@/lib/api", () => ({ fetchMeta: () => new Promise(() => {}) }));
vi.mock("@/lib/repo", () => ({ isRepoReady: () => true, repoReady: Promise.resolve(), getRepo: () => ({ profileSnapshot: () => ({ favorite_topics: confirmed, topics_off: false }), profile: { patch } }) }));
vi.mock("@/lib/repo/hooks", async () => {
  const React = await import("react");
  return { useProfile: () => { const [, f] = React.useState(0); React.useEffect(() => { const l = () => f((x) => x + 1); listeners.add(l); return () => void listeners.delete(l); }, []); return { favorite_topics: confirmed }; } };
});

const { TopicsPicker } = await import("./TopicsPicker");
const tile = (name: string) => screen.getByRole("button", { name });
const pressed = (name: string) => tile(name).getAttribute("aria-pressed");

beforeEach(() => { vi.useFakeTimers(); server = []; confirmed = []; writes.length = 0; n = 0; fail.on = false; patch.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("TopicsPicker quick taps", () => {
  it("NFL, College football, NBA back to back: tiles are chosen at once and the server ends with all three", async () => {
    render(<TopicsPicker />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    for (const name of ["NFL", "College football", "NBA"]) await act(async () => { fireEvent.click(tile(name)); });
    expect(["NFL", "College football", "NBA"].map(pressed)).toEqual(["true", "true", "true"]);   // before any save has answered
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect([...server].sort()).toEqual(["sports.cfb", "sports.nba", "sports.nfl"].sort());
    expect(["NFL", "College football", "NBA"].map(pressed)).toEqual(["true", "true", "true"]);
  });

  it("starting from [nba]: three more taps all land, and un-tapping removes", async () => {
    server = confirmed = ["sports.nba"];
    render(<TopicsPicker />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    for (const name of ["College basketball", "Soccer", "NFL", "NBA"]) await act(async () => { fireEvent.click(tile(name)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(server.sort()).toEqual(["sports.ncaab", "sports.nfl", "sports.soccer"].sort());
  });

  it("a failed save reverts the tiles to the last confirmed list", async () => {
    server = confirmed = ["sports.nba"];
    render(<TopicsPicker />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fail.on = true;
    await act(async () => { fireEvent.click(tile("NFL")); });
    expect(pressed("NFL")).toBe("true");
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(pressed("NFL")).toBe("false");
    expect(pressed("NBA")).toBe("true");
    expect(server).toEqual(["sports.nba"]);
  });
});
