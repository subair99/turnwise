import { db } from "@/lib/db";
import { circleHome } from "@/services/views";
import { TurnRing } from "@/components/TurnRing";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { owedPayouts } from "@/services/views-6b";
import { sendPayoutAgain } from "./actions";

export const dynamic = "force-dynamic";

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function sentence(h: Awaited<ReturnType<typeof circleHome>>) {
  if (!h.open) return "Every turn has been paid out.";
  const n = h.members.length;
  switch (h.open.state) {
    case "pending":
      return `Cycle ${h.open.number} opens soon.`;
    case "collecting":
      return `Cycle ${h.open.number} is collecting: ${h.paidThisCycle} of ${n} paid, ${h.authorizedThisCycle} authorized, due ${day(h.open.dueAt)}.`;
    case "auction":
      return `Cycle ${h.open.number}: the pot is complete and sealed bids are open.`;
    case "settling":
      return `Cycle ${h.open.number}: paying out through PayPal.`;
    default:
      return `Cycle ${h.open.number}: ${h.open.state}.`;
  }
}

export default async function CircleHome({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [h, owed] = await Promise.all([circleHome(db, id), owedPayouts(db, id)]);
  const waiting = h.members.filter((m) => m.collectedCycle === null).length;
  return (
    <>
      <Flash msg={sp.msg} err={sp.err} />
      {owed.map((o) => (
        <div key={o.id} className="callout bad" style={{ marginBottom: 16 }}>
          <p><strong>PayPal could not pay {o.name} {usd(o.owedCents)}.</strong> {o.reason ? `PayPal said: ${o.reason}. ` : ""}The money is held for them in the circle.</p>
          {o.waiting ? (
            <p className="meta">Sent again. Waiting for PayPal to confirm.</p>
          ) : (
            <form action={sendPayoutAgain.bind(null, id, o.id)}>
              <p className="meta">Once {o.name}&rsquo;s PayPal account can receive payments, send it again. The gate pays no more than is owed.</p>
              <SubmitButton className="btn warn" pending="Sending through PayPal…">{`Send ${o.name}'s payout again`}</SubmitButton>
            </form>
          )}
        </div>
      ))}
      <div className="home">
        <div className="ring-wrap">
          <TurnRing
            members={h.members}
            potCents={h.potCents}
            cycleNumber={h.open?.number ?? null}
            totalCycles={h.totalCycles}
            closedCycles={h.closedCycles}
            dueLabel={h.open ? `due ${day(h.open.dueAt)}` : "circle finished"}
            turnMode={h.turnMode}
          />
          <p className="ring-key">
            Filled: collected, with the cycle. Gold outline: still waiting{h.open && h.turnMode === "auction" ? `, in the running for cycle ${h.open.number}` : ""}.
          </p>
        </div>
        <div className="status">
          <p className="now">{sentence(h)}</p>
          <dl className="facts">
            <div><dt>Pot each cycle</dt><dd>{usd(h.potCents)}</dd></div>
            <div><dt>Turns paid out</dt><dd>{h.closedCycles} of {h.totalCycles}</dd></div>
            <div><dt>Still waiting</dt><dd>{waiting} member{waiting === 1 ? "" : "s"}</dd></div>
            <div><dt>Deposits held</dt><dd>{usd(h.depositsHeldCents)}</dd></div>
          </dl>
          <div className="section" style={{ marginTop: 8 }}>
            <h2>Latest</h2>
            {h.notices.length ? (
              <ul className="notices">
                {h.notices.map((n) => (
                  <li key={n.id} data-kind={n.kind}>
                    {n.text}
                    <small>{n.cycle ? `Cycle ${n.cycle}, ` : ""}{day(n.at)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meta">Nothing yet. Notices to members appear here as the circle runs.</p>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Members</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="plain">
            <thead>
              <tr><th>Member</th><th>City</th><th>Turn</th><th>This cycle</th><th className="num">Deposit held</th><th>PayPal wallet</th></tr>
            </thead>
            <tbody>
              {h.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.city}</td>
                  <td>{m.collectedCycle ? `Collected in cycle ${m.collectedCycle}` : "Waiting"}</td>
                  <td>{m.thisCycle}</td>
                  <td className="num">{m.depositCents ? usd(m.depositCents) : m.depositUsedCycle ? `Used in cycle ${m.depositUsedCycle}` : ""}</td>
                  <td>{m.walletSaved ? "Saved" : "Pays by invoice"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
