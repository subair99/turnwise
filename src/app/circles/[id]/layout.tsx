import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { circleHeader } from "@/services/views";
import { CircleTabs } from "@/components/CircleTabs";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function CircleLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await circleHeader(db, id);
  if (!h) notFound();
  const live = h.mode === "live" && h.status === "active";
  return (
    <>
      <header className="circle-head">
        <h1>{h.name}</h1>
        <p className="meta">
          {h.members} members, ${(h.contributionCents / 100).toLocaleString("en-US")} a {h.cadence === "weekly" ? "week" : "month"}, turns by {h.turnMode}
        </p>
        <div className="flags">
          {h.mode === "simulated" ? <span className="flag sim">Simulated history: no PayPal objects</span> : <span className="flag live">Live in the PayPal sandbox</span>}
          {h.secondsPerDay ? <span className="flag">Demo time, accelerated: one day every {h.secondsPerDay} s</span> : null}
          {h.status === "complete" ? <span className="flag">Finished</span> : null}
          {h.status === "attention" ? <span className="flag attention">Needs attention: a payout failed</span> : null}
          {h.status === "archived" ? <span className="flag">Archived test run</span> : null}
          {h.frozen ? <span className="flag" title={h.charterHash}>Charter frozen {h.charterHash.slice(7, 15)}</span> : null}
        </div>
      </header>
      <CircleTabs id={id} />
      <AutoRefresh active={live} />
      {children}
    </>
  );
}
