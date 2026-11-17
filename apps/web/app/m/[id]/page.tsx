// Placeholder. Owner: Lane C (T-25).
import { Placeholder } from "@/components/shell/Placeholder";

export const metadata = { title: "Market" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Placeholder title={`Market ${id}`} line="One market, shareable." />;
}
