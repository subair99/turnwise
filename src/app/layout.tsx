import type { ReactNode } from "react";
import { SandboxBanner } from "@/components/SandboxBanner";

export const metadata = { title: "Turnwise", description: "Your savings circle, without the collector." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <SandboxBanner />
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>{children}</main>
        <footer style={{ padding: 16, fontSize: 12, color: "#666", textAlign: "center" }}>
          Independent hackathon project. Sandbox only. Not affiliated with or endorsed by PayPal.
        </footer>
      </body>
    </html>
  );
}
