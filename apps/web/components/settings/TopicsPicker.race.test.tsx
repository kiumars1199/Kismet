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
const fail = { on: false, once: false };

const patch = vi.fn(async (p: { favorite_topics?: string[] }) => {
  const mine = n++;
  writes.push(p.favorite_topics ?? []);
  await new Promise((r) => setTimeout(r, delays[mine % delays.length]));
  if (fail.on || fail.once) { fail.once = false; throw new Error("save failed"); }
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

beforeEach(() => { vi.useFakeTimers(); server = []; confirmed = []; writes.length = 0; n = 0; fail.on = false; fail.once = false; patch.mockClear(); });
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

  it("taps made while a failing save is in flight are not dropped: only the failed tap reverts, the later one is sent", async () => {
    server = confirmed = ["sports.nfl"];
    render(<TopicsPicker />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fail.once = true;
    await act(async () => { fireEvent.click(tile("Tennis")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); fireEvent.click(tile("Esports")); });
    expect(pressed("Tennis")).toBe("true");
    expect(pressed("Esports")).toBe("true");
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(pressed("Tennis")).toBe("false");   // its save failed: reverted
    expect(pressed("Esports")).toBe("true");
    expect(pressed("NFL")).toBe("true");
    expect(server.length).toBe(2);   // [nfl, esports]: the second tap was sent on top of the confirmed list
    expect(server).toContain("sports.nfl");
    expect(server.some((t) => t !== "sports.nfl")).toBe(true);
    expect(writes.at(-1)).toEqual(server);
  });

  it("the error line names the dropped topic until it is tapped again, or for 5 s", async () => {
    server = confirmed = ["sports.nfl"];
    render(<TopicsPicker />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fail.once = true;
    await act(async () => { fireEvent.click(tile("Tennis")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    await act(async () => { fireEvent.click(tile("Esports")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });   // Esports saved fine afterwards; the line must stay
    expect(screen.getByText("Couldn't save Tennis. Tap it to try again.")).toBeTruthy();
    await act(async () => { fireEvent.click(tile("Tennis")); });
    expect(screen.queryByText(/Couldn't save (Tennis|Esports|Soccer)/)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });   // the retry saves
    fail.once = true;
    await act(async () => { fireEvent.click(tile("Soccer")); await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByText("Couldn't save Soccer. Tap it to try again.")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(5_100); });
    expect(screen.queryByText(/Couldn't save (Tennis|Esports|Soccer)/)).toBeNull();
  });

  it("up to three failed topics are all named; more read 'A, B and N more'; tapping one clears only that topic", async () => {
    server = confirmed = [];
    render(<TopicsPicker />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    for (const name of ["Tennis", "Esports", "Soccer"]) {
      fail.once = true;
      await act(async () => { fireEvent.click(tile(name)); await vi.advanceTimersByTimeAsync(500); });
    }
    expect(screen.getByText("Couldn't save Tennis, Esports and Soccer. Tap them to try again.")).toBeTruthy();
    fail.once = true;
    await act(async () => { fireEvent.click(tile("NFL")); await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByText("Couldn't save Tennis, Esports and 2 more. Tap them to try again.")).toBeTruthy();
    await act(async () => { fireEvent.click(tile("Esports")); });
    expect(screen.getByText("Couldn't save Tennis, Soccer and NFL. Tap them to try again.")).toBeTruthy();
  });

  it("two failed topics read 'A and B'", async () => {
    server = confirmed = [];
    render(<TopicsPicker />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    for (const name of ["Tennis", "Esports"]) {
      fail.once = true;
      await act(async () => { fireEvent.click(tile(name)); await vi.advanceTimersByTimeAsync(500); });
    }
    expect(screen.getByText("Couldn't save Tennis and Esports. Tap them to try again.")).toBeTruthy();
  });
});
