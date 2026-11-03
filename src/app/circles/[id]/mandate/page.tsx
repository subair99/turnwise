import { db } from "@/lib/db";
import { mandateView, membersOf } from "@/services/views-6b";
import { ActingAs } from "@/components/ActingAs";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { setMandate, stopAgent } from "../actions";

export const dynamic = "force-dynamic";

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0 })}`;

export default async function MandatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string; msg?: string; err?: string; question?: string; text?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const members = await membersOf(db, id);
  const me = members.find((m) => m.id === sp.as) ?? members[0];
  if (!me) return <p className="meta">This circle has no members yet.</p>;
  const v = await mandateView(db, id, me.id);
  if (!v) return <p className="meta">Member not found.</p>;
  const back = `/circles/${id}/mandate?as=${me.id}`;
  const mcpUrl = process.env.MCP_PUBLIC_URL ?? `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/mcp`;
  return (
    <div className="narrow">
      <ActingAs members={members} current={me.id} path={`/circles/${id}/mandate`} />
      <Flash msg={sp.msg} err={sp.err} />

      <section className="card">
        <h2>{v.member.name}&rsquo;s Turn Agent</h2>
        {v.mandate ? (
          <>
            <p className="now">
              {v.mandate.revoked
                ? "Stopped. It can't bid for you until you set a new mandate."
                : v.mandate.capCents
                  ? `May bid up to ${usd(v.mandate.capCents)} to collect early, never more.`
                  : "Won't pay anything to collect early. It bids $0 and waits for your turn."}
            </p>
            <p className="meta">You said: &ldquo;{v.mandate.sourceText}&rdquo;</p>
            {v.mandate.notes.length ? <p className="meta">Noted but not enforced: {v.mandate.notes.join("; ")}.</p> : null}
            <p className="meta">
              <span className={`pill ${v.mandate.revoked ? "bad" : "ok"}`}>{v.mandate.revoked ? "Stopped" : "Active"}</span> Mandate hash {v.mandate.hash.slice(7, 19)}
            </p>
            {!v.mandate.revoked && v.member.collectedCycle === null ? (
              <form action={stopAgent.bind(null, id, me.id, back)}>
                <SubmitButton className="btn warn" pending="Stopping…">Stop my Turn Agent</SubmitButton>
              </form>
            ) : null}
          </>
        ) : (
          <p>No mandate yet. Your Turn Agent won&rsquo;t bid until you set one.</p>
        )}
        {v.member.collectedCycle ? <p className="meta">You collected in cycle {v.member.collectedCycle}, so your agent has nothing left to bid for.</p> : null}
      </section>

      <section className="card">
        <h2>{v.mandate ? "Change what your agent may do" : "Tell your Turn Agent what you need"}</h2>
        <p className="meta">Say when you need the pot and the most you&rsquo;d give up to go early. Your agent only accepts terms code can check, so vague ones come back as a question.</p>
        {sp.question ? <div className="callout"><p><strong>Your Turn Agent asks:</strong> {sp.question}</p></div> : null}
        <form className="stack-form" action={setMandate.bind(null, id, me.id)}>
          <label htmlFor="need" className="meta">What do you need?</label>
          <textarea id="need" name="text" maxLength={600} defaultValue={sp.text ?? ""} placeholder="I need the pot before 15 December for shop rent. I'll pay up to $40 to go first." required />
          <SubmitButton pending="Your Turn Agent is reading this…">Save mandate</SubmitButton>
        </form>
      </section>

      {v.token ? (
        <section className="card">
          <h2>Bid from your own assistant</h2>
          <p className="meta">Any assistant that speaks MCP can bid for you with this token. The same gate checks its bids against your mandate, so it can&rsquo;t bid more than you allow. Anyone with the token can bid for you, so keep it private.</p>
          <p className="meta">Endpoint</p>
          <code className="token">{mcpUrl}</code>
          <p className="meta">Your token</p>
          <code className="token">{v.token}</code>
        </section>
      ) : null}

      {v.bids.length ? (
        <section className="card">
          <h2>Bids made for you</h2>
          <table className="plain">
            <thead><tr><th>Cycle</th><th>From</th><th className="num">Discount</th><th>Gate</th></tr></thead>
            <tbody>
              {v.bids.map((b) => (
                <tr key={b.id}>
                  <td>{b.cycle}</td>
                  <td>{b.source}</td>
                  <td className="num">{b.sealed ? "Sealed" : usd(b.discountCents)}</td>
                  <td className={b.accepted ? "ok" : "bad"}>{b.accepted ? "Passed" : `Rejected: ${b.reason}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
