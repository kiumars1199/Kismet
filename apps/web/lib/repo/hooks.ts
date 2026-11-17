"use client";
import { useSyncExternalStore } from "react";
import { getRepo } from "./index";
import { DEFAULT_PROFILE, type CollectionName, type Collections, type Profile } from "./types";

const EMPTY: never[] = [];
const subscribe = (cb: () => void) => getRepo().subscribe(cb); // stable ref: no resubscribe per render

/** Live rows of a user collection. Server render sees []; the client hydrates from storage. */
export function useCollection<K extends CollectionName>(name: K): Collections[K][] {
  return useSyncExternalStore(
    subscribe,
    () => getRepo().snapshot(name),
    () => EMPTY,
  );
}

/** Live profile + display prefs. Server render sees DEFAULT_PROFILE. Write via getRepo().profile.patch(). */
export function useProfile(): Profile {
  return useSyncExternalStore(
    subscribe,
    () => getRepo().profileSnapshot(),
    () => DEFAULT_PROFILE,
  );
}
