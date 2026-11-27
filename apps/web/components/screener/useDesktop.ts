"use client";
import { useSyncExternalStore } from "react";

const Q = "(min-width: 768px)";
const sub = (cb: () => void) => {
  const m = window.matchMedia(Q);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** md breakpoint and up: rows; below: cards. null on the server and during hydration: the caller renders both
 *  layouts and lets CSS pick (`hidden md:block` / `md:hidden`), so a phone gets cards from the first HTML. */
export const useDesktop = (): boolean | null => useSyncExternalStore(sub, () => window.matchMedia(Q).matches, () => null);
