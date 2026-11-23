"use client";
// Renders its children everywhere except on the listed paths. Used for the footer help line on /account, where the pause card
// already shows it (one help line per page); every page keeps the footer disclaimer.
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function HideOnPaths({ paths, children }: { paths: string[]; children: ReactNode }) {
  const pathname = usePathname();
  return pathname && paths.includes(pathname) ? null : <>{children}</>;
}
