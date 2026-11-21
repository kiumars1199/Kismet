// Owner: Lane D2 (alerts, demo F-11/F-23).
// #23 (Marc, Nov 20): AlertsView reads the URL (useSearchParams), so the server HTML stops at this Suspense
// boundary. With no fallback the first load was an empty page until the script ran; now it is the page skeleton.
import { Suspense } from "react";
import { AlertsView } from "@/components/alerts/AlertsView";
import { PageSkeleton } from "@/components/shell/PageSkeleton";

export const metadata = { title: "Alerts", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AlertsView />
    </Suspense>
  );
}
