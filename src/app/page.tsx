import Link from "next/link";
import { db } from "@/lib/db";
import { circleList } from "@/services/views";

export const dynamic = "force-dynamic";

export default async function Home() {
  const circles = await circleList(db);
  return (
    <section className="judge">
      <div style={{ display: "grid", gap: 10 }}>
        <h1>Your savings circle, without the collector.</h1>
        <p className="meta">
          Turnwise runs an ajo, esusu or tanda with PayPal and three AI agents. The agents propose; a policy gate written in code
          decides every money move.
        </p>
      </div>
      {circles.length === 0 ? (
        <div className="callout">
          <p>No circles yet. Open judge mode to load the demo circle or start a live one in the PayPal sandbox.</p>
          <p><Link href="/judge">Open judge mode</Link></p>
        </div>
      ) : (
        <div className="section">
          <h2>Circles</h2>
          <ul className="list">
            {circles.map((c) => (
              <li key={c.id}>
                <Link href={`/circles/${c.id}`}>{c.name}</Link>
                <span className="meta">
                  {c.members} members, {c.mode === "simulated" ? "simulated history" : c.status === "complete" ? "finished" : c.status === "attention" ? "needs attention" : "live in the sandbox"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
