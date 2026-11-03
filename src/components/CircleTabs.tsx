"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Home" },
  { href: "/ledger", label: "Ledger" },
  { href: "/auction", label: "Auction" },
  { href: "/trust", label: "Trust" },
  { href: "/passport", label: "Passport" },
  { href: "/charter", label: "Charter" },
  { href: "/mandate", label: "My mandate" },
];

export function CircleTabs({ id }: { id: string }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Circle">
      {TABS.map((t) => {
        const href = `/circles/${id}${t.href}`;
        return (
          <Link key={t.label} href={href} aria-current={path === href || (t.href !== "" && path.startsWith(href)) ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
