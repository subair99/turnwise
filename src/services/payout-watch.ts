// Payouts are confirmed with PayPal, not assumed. A batch PayPal accepts can still fail later
// (e.g. RECEIVER_COUNTRY_NOT_ALLOWED). Failed items are reversed in the ledger and held as owed to the member.
import type { Prisma, PrismaClient } from "@prisma/client";
import { accounts } from "@/domain/ledger";
import { payoutBatchOutcome } from "@/gate/readonly";
import { postEntry } from "./ledger-store";
import { notice } from "./notices";

const FINAL_BATCH = new Set(["SUCCESS", "DENIED", "CANCELED"]);
const FAILED_ITEM = new Set(["FAILED", "RETURNED", "BLOCKED", "DENIED", "REFUNDED", "REVERSED", "CANCELED"]);
const RECHECK_MS = 10_000;

export const payoutOwedAccount = (memberId: string) => `liability:payout-owed:${memberId}`;

export async function trackPayoutBatch(
  db: PrismaClient,
  b: { id: string; circleId: string; purpose: "settlement" | "refund"; cycleNumber: number | null; items: { memberId: string; amount: number }[] },
) {
  await db.payoutBatch.upsert({
    where: { id: b.id },
    create: { id: b.id, circleId: b.circleId, purpose: b.purpose, cycleNumber: b.cycleNumber, items: b.items as unknown as Prisma.InputJsonValue },
    update: {},
  });
}

export async function confirmPayouts(db: PrismaClient, circleId: string, log: (m: string) => void = () => {}) {
  const open = await db.payoutBatch.findMany({ where: { circleId, status: "pending" } });
  for (const b of open) {
    if (b.checkedAt && Date.now() - b.checkedAt.getTime() < RECHECK_MS) continue;
    let outcome;
    try {
      outcome = await payoutBatchOutcome(b.id);
    } catch (err) {
      await db.payoutBatch.update({ where: { id: b.id }, data: { checkedAt: new Date() } });
      log(`payout ${b.id}: status check failed (${(err as Error).message.slice(0, 60)})`);
      continue;
    }
    const itemsFinal = outcome.items.length > 0 && outcome.items.every((i) => i.status !== "PENDING" && i.status !== "ONHOLD" && i.status !== "NEW");
    if (!FINAL_BATCH.has(outcome.batchStatus) && !itemsFinal) {
      await db.payoutBatch.update({ where: { id: b.id }, data: { checkedAt: new Date() } });
      continue;
    }

    const sent = b.items as unknown as { memberId: string; amount: number }[];
    const failed = outcome.batchStatus === "DENIED" && outcome.items.length === 0
      ? sent.map((s, index) => ({ index, status: "DENIED", amountCents: s.amount, error: "batch denied" }))
      : outcome.items.filter((i) => FAILED_ITEM.has(i.status));
    const failures: { memberId: string; amount: number; reason: string }[] = [];
    for (const f of failed) {
      const memberId = sent[f.index]?.memberId;
      if (!memberId) continue;
      const amount = sent[f.index]!.amount;
      // Money never left: bring it back into circle cash and record it as owed to the member.
      await postEntry(db, circleId, {
        description: `Payout failed: ${memberId}${b.cycleNumber ? `, cycle ${b.cycleNumber}` : ""} (${f.error ?? f.status})`,
        paypalObjectId: b.id,
        postings: [
          { account: accounts.cash, debit: amount, credit: 0 },
          { account: payoutOwedAccount(memberId), debit: 0, credit: amount },
        ],
        requestId: `payout-failed:${b.id}:${f.index}`,
      });
      const member = await db.member.findUnique({ where: { id: memberId } });
      await notice(db, {
        circleId,
        memberId,
        cycleNumber: b.cycleNumber ?? undefined,
        kind: "payout_failed",
        text: `PayPal could not pay ${member?.displayName ?? "a member"} $${(amount / 100).toFixed(2)} (${f.error ?? f.status}). The money is held for them; the organizer will retry once their PayPal account can receive payments.`,
      });
      failures.push({ memberId, amount, reason: f.error ?? f.status });
      log(`payout ${b.id}: ${member?.displayName ?? memberId} FAILED (${f.error ?? f.status}); $${(amount / 100).toFixed(2)} held`);
    }
    const status = failures.length === 0 ? "success" : failures.length === sent.length ? "failed" : "partial";
    await db.payoutBatch.update({ where: { id: b.id }, data: { status, failures: failures as unknown as Prisma.InputJsonValue, checkedAt: new Date() } });
    if (status === "success") log(`payout ${b.id} (${b.purpose}${b.cycleNumber ? ` cycle ${b.cycleNumber}` : ""}) confirmed by PayPal`);
  }
  const all = await db.payoutBatch.findMany({ where: { circleId }, select: { status: true } });
  return {
    pending: all.filter((x) => x.status === "pending").length,
    failed: all.filter((x) => x.status === "failed" || x.status === "partial").length,
    confirmed: all.filter((x) => x.status === "success").length,
  };
}
