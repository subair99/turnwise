"use client";
// Re-renders the page's server data every few seconds while a live circle is running.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ active, ms = 3000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return null;
}
