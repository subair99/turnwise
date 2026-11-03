import { db } from "@/lib/db";
import { trustView } from "@/services/views-6b";
import { ActionLog } from "@/components/grid/ActionLog";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { stopAgent } from "../actions";

export const dynamic = "force-dynamic";

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0 })}`;

export default async function TrustPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const t = await trustView(db, id);
  return (
    <>
      <p className="meta" style={{ marginBottom: 14 }}>
        What each Turn Agent is allowed to do, how close it has come to its limit, and every decision the policy gate has made.
        The gate allowed {t.allowed} proposal{t.allowed === 1 ? "" : "s"} and refused {t.refused}.
      </p>
      <Flash msg={sp.msg} err={sp.err} />

      <section className="section" style={{ marginTop: 0 }}>
        <h2>Mandates</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="plain">
            <thead>
              <tr><th>Member</th><th>Status</th><th>Highest bid against the cap</th><th className="num">Cap</th><th className="num">Rejected bids</th><th></th></tr>
            </thead>
            <tbody>
              {t.meters.map((m) => {
                const pct = m.capCents ? Math.min(100, Math.round((m.highestCents / m.capCents) * 100)) : 0;
                return (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td><span className={`pill ${m.revoked ? "bad" : m.hasMandate ? "ok" : ""}`}>{!m.hasMandate ? "No mandate" : m.revoked ? "Stopped" : "Active"}</span></td>
                    <td>
                      {m.capCents ? (
                        <div style={{ display: "grid", gap: 4 }}>
                          <div className={`meter${pct >= 100 ? " full" : ""}`} role="img" aria-label={`${pct}% of the cap`}><span style={{ width: `${pct}%` }} /></div>
                          <span className="meta">{usd(m.highestCents)} of {usd(m.capCents)}</span>
                        </div>
                      ) : (
                        <span className="meta">{m.hasMandate ? "Won't pay to go early" : ""}</span>
                      )}
                    </td>
                    <td className="num">{m.hasMandate ? usd(m.capCents) : ""}</td>
                    <td className={`num${m.rejected ? " bad" : ""}`}>{m.rejected || ""}</td>
                    <td>
                      {m.collected ? (
                        <span className="meta">Collected</span>
                      ) : m.hasMandate && !m.revoked ? (
                        <form action={stopAgent.bind(null, id, m.id, `/circles/${id}/trust`)}>
                          <SubmitButton className="btn warn" pending="Stopping…">Revoke</SubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Action log</h2>
        <p className="meta">Every money move an agent proposed, with the gate&rsquo;s decision. Drag a column into the bar to group, for example by Gate to see only refusals.</p>
        <ActionLog rows={t.rows} />
      </section>
    </>
  );
}
