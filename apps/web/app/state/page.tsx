// F9: pick your US state without an account (the cookie /api/state sets). Signed-in users also have it in /settings.
import Link from "next/link";
import { StatePicker } from "@/components/venues/StatePicker";
import { safeNext } from "@/lib/venues/next-path";

export const metadata = { title: "Your state", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === "string" ? raw : null);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <StatePicker next={next} as="h1" />
      <Link href={next ?? "/"} className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-2 hover:text-text">Back</Link>
    </div>
  );
}
