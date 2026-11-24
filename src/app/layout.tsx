import type { Metadata } from "next";
import { Schibsted_Grotesk, Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "../components/TopBar";

const head = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", weight: ["600"] });
const body = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono" });
export const metadata: Metadata = { title: "All In Capital", description: "Inbound triage for a pre-seed fund" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh pb-20 md:pb-0">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3">Skip to content</a>
        <TopBar />
        <main id="main" className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">{children}</main>
      </body>
    </html>
  );
}
