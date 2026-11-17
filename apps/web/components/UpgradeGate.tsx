"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEntitlements, type Feature } from "@/lib/entitlements";

/** Renders children when the tier has `feature`; otherwise a blurred, inert preview with an upgrade link. */
export function UpgradeGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { can } = useEntitlements();
  if (can(feature)) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden="true" inert className="pointer-events-none select-none blur-sm">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Link
          href="/pricing"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-black shadow"
        >
          Upgrade to unlock
        </Link>
      </div>
    </div>
  );
}

export default UpgradeGate;
