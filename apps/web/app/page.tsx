// / (docs/19 P1, T-276): signed-in users and demo mode get Best bets. A signed-out visitor always gets the landing
// (the middleware sends a signed-out /?m=… deep link to /signup?next=…; rendering the landing here too means no
// query can show Best bets without an account). Only a build without accounts configured keeps the old rule:
// bare / is the landing, any product query shows the Free Best bets.
import { cache } from "react";
import { Landing } from "@/components/landing/Landing";
import { authEnabled, getMe } from "@/lib/auth/server";
import { TRACKING } from "@/lib/auth/public-paths";
import { DEMO_MODE } from "@/lib/config";
import { FREE_BEST_BETS_A_DAY } from "@/lib/entitlements";
import BestBetsPage, { metadata as bets } from "./bets/page";

type Search = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Search> };

const me = cache(getMe);   // generateMetadata and the page share one auth lookup per request
const landing = async (sp: Search) =>
  !DEMO_MODE && !(await me()).user && (authEnabled() || Object.keys(sp).every((k) => TRACKING.test(k)));

export async function generateMetadata({ searchParams }: Props) {
  return (await landing(await searchParams))
    ? { title: { absolute: "Kismet · Which Polymarket bets are worth it today?" }, description: `Placing a bet or two? See which Polymarket bets look like good value today, how often bets like them win, and what $10 pays. ${FREE_BEST_BETS_A_DAY} bets a day, free. No card.` }
    : bets;
}

export default async function Page(props: Props) {
  return (await landing(await props.searchParams)) ? <Landing /> : <BestBetsPage {...props} />;
}
