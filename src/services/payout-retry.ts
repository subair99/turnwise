// Sends a held payout again (after PayPal could not complete it), through the gate: never more than is owed.
import type { PrismaClient } from "@prisma/client";
import { accounts } from "@/domain/ledger";
import { gateFor } from "./gate-context";
import { loadBalances, postEntry } from "./ledger-store";
import { payoutOwedAccount, trackPayoutBatch } from "./payout-watch";

export async function retryOwedPayout(db: PrismaClient, circleId: string, memberId: string) {
  const bal = await loadBalances(db, circleId);
  const owed = -(bal.get(payoutOwedAccount(memberId)) ?? 0);
  if (owed <= 0) return { retried: false as const, reasons: ["nothing is owed to this member"] };
  const waiting = await db.payoutBatch.count({ where: { circleId, purpose: "retry", status: "pending" } });
  if (waiting) return { retried: false as const, reasons: ["a payout sent again is still waiting for PayPal"] };

  const attempt = (await db.payoutBatch.count({ where: { circleId, purpose: "retry" } })) + 1;
  const last = await db.cycle.findFirstOrThrow({ where: { circleId }, orderBy: { number: "desc" } });
  const g = await gateFor(db, circleId, last.number, "treasurer");
  const res = await g.run({ kind: "repay_owed", circleId, cycle: last.number, charterHash: g.charterHash, memberId, amount: owed, attempt });
  if (!res.allowed) return { retried: false as const, reasons: res.reasons };

  await postEntry(db, circleId, {
    description: `Payout sent again: ${memberId}`,
    paypalObjectId: res.extracted.payoutBatchId,
    postings: [
      { account: payoutOwedAccount(memberId), debit: owed, credit: 0 },
      { account: accounts.cash, debit: 0, credit: owed },
    ],
    requestId: `retry:${circleId}:${memberId}:${attempt}`,
  });
  if (res.extracted.payoutBatchId) {
    await trackPayoutBatch(db, { id: res.extracted.payoutBatchId, circleId, purpose: "retry", cycleNumber: null, items: [{ memberId, amount: owed }] });
  }
  return { retried: true as const, payoutBatchId: res.extracted.payoutBatchId, amount: owed };
}
