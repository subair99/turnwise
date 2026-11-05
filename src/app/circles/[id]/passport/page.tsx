import { db } from "@/lib/db";
import { passportView } from "@/services/views-6b";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { checkWithPayPal } from "../actions";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

export default async function PassportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await passportView(db, id);
  const r = p.reconciliation;
  return (
    <>
      <p className="meta" style={{ marginBottom: 14 }}>
        Each member&rsquo;s record in this circle: how they paid, when they collected and what happened to their deposit. Members can show it
        when they join their next circle.
      </p>
      <Flash msg={sp.msg} err={sp.err} />
      <div className="callout no-print" style={{ marginBottom: 18 }}>
        {p.mode === "simulated" ? (
          <p>Simulated history: there are no PayPal records to check these against.</p>
        ) : r ? (
          <p>
            Checked against PayPal {day(r.at)}: {r.checked} records, difference from the ledger{" "}
            <strong className={r.driftCents ? "bad" : "ok"}>${(r.driftCents / 100).toFixed(2)}</strong>
            {r.unverified ? `, ${r.unverified} not found` : ""}.
          </p>
        ) : (
          <p>Not yet checked against PayPal.</p>
        )}
        {p.mode === "live" ? (
          <form action={checkWithPayPal.bind(null, id)}>
            <SubmitButton className="btn quiet" pending="Checking with PayPal…">Check against PayPal now</SubmitButton>
          </form>
        ) : null}
      </div>
      <div className="passports">
        {p.passports.map((m) => (
          <article key={m.id} className="passport">
            <h3>{m.name}</h3>
            {m.city ? <p className="meta">{m.city}</p> : null}
            <p className="record">{m.record}</p>
            <ul>
              {m.late ? <li className="bad">{m.late} paid late</li> : null}
              {m.missed ? <li className="bad">{m.missed} missed, covered by their deposit</li> : null}
              <li>{m.collected}</li>
              <li>Deposit: {m.deposit}</li>
            </ul>
            <footer>Charter {p.charterHash.slice(7, 19)}{p.mode === "simulated" ? ", simulated history" : ""}</footer>
          </article>
        ))}
      </div>
    </>
  );
}
