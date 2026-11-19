// / (docs/19 P1): signed-in users and demo mode get Best bets, unchanged. A signed-out visitor on bare / gets the
// landing; with a query (?m= drawer links, shared filter views, the /flags redirect) they get Best bets, so deep
// links keep working. Signed-out Best bets also lives at /bets (the landing's CTA).
import { cache } from "react";
import { Landing } from "@/components/landing/Landing";
import { getMe } from "@/lib/auth/server";
import { DEMO_MODE } from "@/lib/config";
import BestBetsPage, { metadata as bets } from "./bets/page";

type Search = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Search> };

const me = cache(getMe);   // generateMetadata and the page share one auth lookup per request
const landing = async (sp: Search) => !DEMO_MODE && !(await me()).user && Object.keys(sp).length === 0;

export async function generateMetadata({ searchParams }: Props) {
  return (await landing(await searchParams))
    ? { title: { absolute: "Kismet · Less luck, more math." }, description: "Prediction-market bets priced below how often bets like them have won, after fees and the spread. See today's list free." }
    : bets;
}

export default async function Page(props: Props) {
  return (await landing(await props.searchParams)) ? <Landing /> : <BestBetsPage {...props} />;
}
