import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";
import { MobileNav } from "@/components/shell/MobileNav";
import { DrawerHost } from "@/components/market/DrawerHost";
import { AlertRunner } from "@/components/alerts/AlertRunner";
import { DisplayEffects } from "@/components/settings/DisplayEffects";
import { Shortcuts } from "@/components/keyboard/Shortcuts";
import { AuthBoot } from "@/components/auth/AuthBoot";
import { siteUrl } from "@/lib/site";
import { TicketHost } from "@/components/trade/TradeTicket";
import { ComboTray } from "@/components/combo/ComboTray";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: "MarketEdge", type: "website" },
  title: { default: "MarketEdge", template: "%s · MarketEdge" },
  description: "Prediction-market analytics: which contracts are priced below how often bets like them have won.",
};

export const viewport: Viewport = { themeColor: "#070a09" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="flex min-h-dvh flex-col bg-background text-text">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-input focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
        <Footer />
        <MobileNav />
        <Suspense>
          <DrawerHost />
          <Shortcuts />
        </Suspense>
        <TicketHost />
        <ComboTray />
        <AlertRunner />
        <DisplayEffects />
        <AuthBoot />
      </body>
    </html>
  );
}
