// Sign up (docs/19 P2, T-275): the same form as /login; the password tab creates the account (email confirmation).
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata = { title: "Sign up free", description: "Create a free Kismet account with Google, an email and password, or an email link. No card needed." };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <AuthPage mode="signup" searchParams={searchParams} />;
}
