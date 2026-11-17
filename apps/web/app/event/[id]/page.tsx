// Placeholder. Owner: Lane C (T-25).
import { Placeholder } from "@/components/shell/Placeholder";

export const metadata = { title: "Event" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder title={`Event ${id}`} line="All markets in this event." />;
}
