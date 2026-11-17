// Placeholder. Owner: Lane D (T-36).
import { Placeholder } from "@/components/shell/Placeholder";

export const metadata = { title: "Dashboard" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder title={`Dashboard ${id}`} line="One dashboard." />;
}
