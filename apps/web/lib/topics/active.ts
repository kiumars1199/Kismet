// The mounted topic picker's saver, reachable after it unmounts (onboarding leaves step 0 with saves still in flight) so that
// finishing setup can wait for them and build its landing URL from the list the user chose, not from the first save's answer.
import type { createTopicSaver } from "./saver";

type Saver = ReturnType<typeof createTopicSaver>;
let active: Saver | null = null;
export const setActiveTopicSaver = (s: Saver | null) => { active = s; };

/** The list the user has chosen but the server hasn't confirmed (null when nothing is pending). */
export const pendingTopics = (): string[] | null => active?.pending() ?? null;

/** Wait (at most capMs) for every topic save to land. After the cap, the pending list is sent once more with keepalive. */
export async function settleTopicSaves(capMs = 2_000): Promise<void> {
  if (!active) return;
  if (!(await active.settled(capMs))) active.freeze();
}
