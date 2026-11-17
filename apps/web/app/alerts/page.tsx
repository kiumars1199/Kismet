// Owner: Lane D2 (alerts, demo F-11/F-23).
import { Suspense } from "react";
import { AlertsView } from "@/components/alerts/AlertsView";

export const metadata = { title: "Alerts" };

export default function Page() {
  return (
    <Suspense>
      <AlertsView />
    </Suspense>
  );
}
