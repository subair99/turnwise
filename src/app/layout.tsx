import type { ReactNode } from "react";
import Link from "next/link";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";
import { SandboxBanner } from "@/components/SandboxBanner";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata = { title: "Turnwise", description: "Your savings circle, without the collector." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <SandboxBanner />
        <header className="site-head">
          <Link href="/" className="wordmark">Turnwise</Link>
          <nav>
            <Link href="/">Circles</Link>
            <Link href="/judge">Judge mode</Link>
          </nav>
        </header>
        <main className="shell">{children}</main>
        <footer className="foot">Independent hackathon project. PayPal sandbox only. Not affiliated with or endorsed by PayPal.</footer>
      </body>
    </html>
  );
}
