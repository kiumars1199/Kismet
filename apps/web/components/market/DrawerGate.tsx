"use client";
// Loaded by LazyHosts as the site-wide drawer host. The real DrawerHost (MarketDetail, ~13 kB) is fetched only once a
// URL asks for the drawer (?m=<market id>), not on every page load (Lighthouse TBT, AUDIT run 3 fail 5).
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const Host = dynamic(() => import("./DrawerHost").then((m) => m.DrawerHost), { ssr: false });

export function DrawerHost() {
  return useSearchParams().has("m") ? <Host /> : null;
}
