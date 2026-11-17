// Owner: Lane D2 (T-34).
import { PageTitle } from "@/components/kit";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings", robots: { index: false } };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageTitle title="Settings" sub="Saved in this browser. Changes apply right away." />
      <SettingsForm />
    </div>
  );
}
