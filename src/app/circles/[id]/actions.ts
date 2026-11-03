"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mandateFromText } from "@/services/mandates";
import { requestAmendment } from "@/services/charters";
import { approveAmendment, stopTurnAgent } from "@/services/governance";
import { retryOwedPayout } from "@/services/payout-retry";
import { reconcileCircle } from "@/services/reconcile";

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

export async function setMandate(circleId: string, memberId: string, form: FormData) {
  const text = String(form.get("text") ?? "").trim().slice(0, 600);
  let to: string;
  if (!text) {
    to = `/circles/${circleId}/mandate?${q({ as: memberId, err: "Tell your Turn Agent what you need first." })}`;
  } else {
    try {
      const r = await mandateFromText(db, memberId, text);
      to = r.saved
        ? `/circles/${circleId}/mandate?${q({ as: memberId, msg: "Saved. Your Turn Agent now works within this mandate." })}`
        : r.quarantined
          ? `/circles/${circleId}/mandate?${q({ as: memberId, err: "That reads like an instruction to the system, so it wasn't used. Describe what you need instead." })}`
          : `/circles/${circleId}/mandate?${q({ as: memberId, question: r.question ?? "", text })}`;
    } catch (err) {
      to = `/circles/${circleId}/mandate?${q({ as: memberId, err: `The Turn Agent couldn't read that right now (${(err as Error).message.slice(0, 80)}). Try again.`, text })}`;
    }
  }
  redirect(to);
}

export async function stopAgent(circleId: string, memberId: string, back: string) {
  await stopTurnAgent(db, circleId, memberId);
  redirect(`${back}${back.includes("?") ? "&" : "?"}${q({ msg: "Turn Agent stopped. Any bid it makes is now refused by the gate." })}`);
}

export async function askForChange(circleId: string, memberId: string, form: FormData) {
  const text = String(form.get("text") ?? "").trim().slice(0, 600);
  let to: string;
  try {
    const r = text ? await requestAmendment(db, circleId, memberId, text) : null;
    to = `/circles/${circleId}/charter?${q({ as: memberId, msg: r ? (r.created ? "The Treasurer drafted your change below. It needs every member's approval." : r.explanation) : "Describe the change you'd like." })}`;
  } catch (err) {
    to = `/circles/${circleId}/charter?${q({ as: memberId, err: `The Treasurer couldn't answer right now (${(err as Error).message.slice(0, 80)}).` })}`;
  }
  redirect(to);
}

export async function approveChange(circleId: string, charterId: string, memberId: string) {
  const r = await approveAmendment(db, charterId, memberId);
  redirect(`/circles/${circleId}/charter?${q({ as: memberId, msg: r.everyone ? "Approved by every member. The change applies from the next circle." : `Approved. ${r.approvals} member${r.approvals === 1 ? " has" : "s have"} approved so far.` })}`);
}

export async function sendPayoutAgain(circleId: string, memberId: string) {
  const r = await retryOwedPayout(db, circleId, memberId);
  redirect(`/circles/${circleId}?${q(r.retried ? { msg: `Payout sent again through PayPal (${r.payoutBatchId ?? "batch pending"}). It is confirmed when PayPal reports success.` } : { err: `Not sent: ${r.reasons.join("; ")}` })}`);
}

export async function checkWithPayPal(circleId: string) {
  let to: string;
  try {
    const r = await reconcileCircle(db, circleId);
    await db.auditLog.create({
      data: {
        circleId,
        agent: "reconciler",
        proposal: { kind: "reconcile", checked: r.checked, unverified: r.unverified, driftCents: r.driftCents },
        allowed: true,
        reasons: r.rows.filter((x) => x.driftCents !== 0).map((x) => `${x.entry}: ledger ${x.ledgerCents} vs PayPal ${x.paypalCents ?? "?"}`),
      },
    });
    to = `/circles/${circleId}/passport?${q({ msg: `Checked ${r.checked} PayPal records. Difference from the ledger: $${(r.driftCents / 100).toFixed(2)}.` })}`;
  } catch (err) {
    to = `/circles/${circleId}/passport?${q({ err: `Couldn't reach PayPal (${(err as Error).message.slice(0, 80)}).` })}`;
  }
  redirect(to);
}
