import { db } from "@/lib/db";
import { charterView, membersOf } from "@/services/views-6b";
import { ActingAs } from "@/components/ActingAs";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { approveChange, askForChange } from "../actions";

export const dynamic = "force-dynamic";

export default async function CharterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string; msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [view, members] = await Promise.all([charterView(db, id), membersOf(db, id)]);
  if (!view) return <p className="meta">This circle has no charter yet.</p>;
  const me = members.find((m) => m.id === sp.as) ?? members[0]!;
  return (
    <div className="narrow">
      <ActingAs members={members} current={me.id} path={`/circles/${id}/charter`} />
      <Flash msg={sp.msg} err={sp.err} />

      <section className="card">
        <h2>The rules</h2>
        <p className="meta">Version {view.version}, approved by {view.approvedBy} of {view.members} members and frozen. Code enforces every rule; the agents can&rsquo;t change them.</p>
        <ol className="rules">{view.rules.map((r) => <li key={r}>{r}</li>)}</ol>
        <p className="meta" style={{ wordBreak: "break-all" }}>Charter hash: {view.hash}</p>
      </section>

      {view.drafts.length ? (
        <section className="section" style={{ marginTop: 0 }}>
          <h2>Proposed changes</h2>
          {view.drafts.map((d) => (
            <article key={d.id} className="card">
              <p><strong>{d.requestedBy || "A member"} asked:</strong> &ldquo;{d.request}&rdquo;</p>
              {d.note ? <p><strong>The Treasurer:</strong> {d.note}</p> : null}
              {d.changes.length ? (
                <ul className="rules">{d.changes.map((c) => <li key={c.field}>{c.field}: {c.from} → {c.to}</li>)}</ul>
              ) : null}
              <p className="meta">
                {d.everyone ? "Approved by every member. Applies from the next circle, so this circle's rules don't change mid-way." : `Approved by ${d.approvedBy.length} of ${view.members}: ${d.approvedBy.join(", ") || "nobody yet"}. Needs every member.`}
              </p>
              {!d.everyone && !d.approvalIds.includes(me.id) ? (
                <form action={approveChange.bind(null, id, d.id, me.id)}>
                  <SubmitButton pending="Approving…">{`Approve as ${me.name}`}</SubmitButton>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="card">
        <h2>Ask for a change</h2>
        <p className="meta">The Treasurer explains what your request would change and drafts it for every member to approve. Nothing changes until they all do.</p>
        <form className="stack-form" action={askForChange.bind(null, id, me.id)}>
          <label htmlFor="change" className="meta">What would you like to change?</label>
          <textarea id="change" name="text" maxLength={600} placeholder="Can we add my cousin to the circle mid-cycle?" required />
          <SubmitButton pending="The Treasurer is reading the charter…">Ask the Treasurer</SubmitButton>
        </form>
      </section>
    </div>
  );
}
