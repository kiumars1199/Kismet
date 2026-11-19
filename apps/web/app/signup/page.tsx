// Sign up (docs/19 P2): the same flow as /login with sign-up copy. The email link creates the free account.
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata = { title: "Sign up free", description: "Create a free Kismet account with an email link. No password, no card." };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <AuthPage mode="signup" searchParams={searchParams} />;
}
