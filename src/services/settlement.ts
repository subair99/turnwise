// Cycle settlement: one Payouts batch (winner + dividends), deposit held as a liability, cycle closed.
import type { PrismaClient } from "@prisma/client";
import { settle, type Settlement } from "@/domain/auction";
import { depositRequired } from "@/domain/deposits";
import { depositRefundEntry, settlementEntry } from "@/domain/ledger";
import { gateFor } from "./gate-context";
import { postEntry } from "./ledger-store";
import { trackPayoutBatch } from "./payout-watch";

export async function setCycleState(db: PrismaClient, circleId: string, number: number, state: string) {
  await db.cycle.update({ where: { circleId_number: { circleId, number } }, data: { state } });
}

export type SettleResult =
  | { settled: true; settlement: Settlement; payoutBatchId?: string }
  | { settled: false; reasons: string[] };

export async function settleCycle(
  db: PrismaClient,
  circleId: string,
  cycleNumber: number,
  winnerId: string,
  discountCents: number,
): Promise<SettleResult> {
  const cycle = await db.cycle.findUniqueOrThrow({ where: { circleId_number: { circleId, number: cycleNumber } } });
  if (cycle.state === "closed") return { settled: false, reasons: ["cycle already settled"] };

  await setCycleState(db, circleId, cycleNumber, "settling");
  const g = await gateFor(db, circleId, cycleNumber, "treasurer");
  const totalCycles = await db.cycle.count({ where: { circleId } });
  const s = settle({
    contribution: g.body.contributionCents,
    memberIds: g.ctx.charter.memberIds,
    winnerId,
    discount: discountCents,
    depositOn: depositRequired(cycleNumber, totalCycles, g.body.depositOn),
  });
  const items = [{ memberId: winnerId, amount: s.winnerPayout }, ...s.dividends].filter((i) => i.amount > 0);

  const res = await g.run({ kind: "payout_batch", circleId, cycle: cycleNumber, charterHash: g.charterHash, items });
  if (!res.allowed) {
    await setCycleState(db, circleId, cycleNumber, cycle.state);
    return { settled: false, reasons: res.reasons };
  }

  await postEntry(db, circleId, { ...settlementEntry(cycleNumber, s, res.extracted.payoutBatchId), requestId: `settle:${circleId}:${cycleNumber}` });
  if (res.extracted.payoutBatchId) await trackPayoutBatch(db, { id: res.extracted.payoutBatchId, circleId, purpose: "settlement", cycleNumber, items });
  await db.member.update({ where: { id: winnerId }, data: { collectedCycle: cycleNumber, depositCents: { increment: s.deposit } } });
  await db.cycle.update({
    where: { circleId_number: { circleId, number: cycleNumber } },
    data: { state: "closed", winnerId, discountCents },
  });
  return { settled: true, settlement: s, payoutBatchId: res.extracted.payoutBatchId };
}

export async function refundDeposit(db: PrismaClient, circleId: string, memberId: string) {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.depositCents <= 0) return { refunded: false, reasons: ["no deposit held"] };
  const last = await db.cycle.findFirstOrThrow({ where: { circleId }, orderBy: { number: "desc" } });

  const g = await gateFor(db, circleId, last.number, "treasurer");
  const res = await g.run({ kind: "refund_deposit", circleId, cycle: last.number, charterHash: g.charterHash, memberId, amount: member.depositCents });
  if (!res.allowed) return { refunded: false, reasons: res.reasons };

  await postEntry(db, circleId, {
    ...depositRefundEntry(memberId, member.depositCents, res.extracted.payoutBatchId),
    requestId: `refund:${circleId}:${memberId}`,
  });
  if (res.extracted.payoutBatchId) {
    await trackPayoutBatch(db, { id: res.extracted.payoutBatchId, circleId, purpose: "refund", cycleNumber: null, items: [{ memberId, amount: member.depositCents }] });
  }
  await db.member.update({ where: { id: memberId }, data: { depositCents: 0 } });
  return { refunded: true, payoutBatchId: res.extracted.payoutBatchId };
}
