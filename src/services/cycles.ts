// Opening a cycle: contributions become due; members without a saved wallet get a PayPal invoice.
// If the previous cycle closed late, this and later due dates move so members still get the full lead time.
import type { PrismaClient } from "@prisma/client";
import { gateFor, loadCircle } from "./gate-context";
import { setCycleState } from "./settlement";
import { notice } from "./notices";

const DAY = 86_400_000;

export async function openCycle(db: PrismaClient, circleId: string, cycleNumber: number, log: (m: string) => void = () => {}, at?: Date) {
  const { circle, body } = await loadCircle(db, circleId);
  const cycle = circle.cycles.find((c) => c.number === cycleNumber);
  if (at && cycle) {
    const earliest = at.getTime() + (body.preauthLeadDays + 2) * DAY;
    if (cycle.dueAt.getTime() < earliest) {
      const shift = earliest - cycle.dueAt.getTime();
      for (const c of circle.cycles.filter((x) => x.number >= cycleNumber)) {
        await db.cycle.update({ where: { id: c.id }, data: { dueAt: new Date(c.dueAt.getTime() + shift) } });
      }
      const days = Math.ceil(shift / DAY);
      await notice(db, { circleId, cycleNumber, kind: "info", text: `Cycle ${cycleNumber} opened late, so this and later due dates moved ${days} day${days === 1 ? "" : "s"}.` });
      log(`cycle ${cycleNumber} opened late; due dates moved ${days} days`);
    }
  }
  await setCycleState(db, circleId, cycleNumber, "collecting");
  await db.contribution.createMany({
    data: circle.members.map((m) => ({ circleId, memberId: m.id, cycleNumber, amountCents: body.contributionCents, status: "due" })),
    skipDuplicates: true,
  });

  for (const m of circle.members.filter((x) => !x.vaultId)) {
    try {
      const g = await gateFor(db, circleId, cycleNumber, "treasurer");
      const res = await g.run({ kind: "send_invoice", circleId, cycle: cycleNumber, charterHash: g.charterHash, memberId: m.id, amount: body.contributionCents });
      if (res.allowed && res.extracted.invoiceId) {
        await db.contribution.update({
          where: { memberId_cycleNumber: { memberId: m.id, cycleNumber } },
          data: { invoiceId: res.extracted.invoiceId, method: "invoice", status: "pending" },
        });
        log(`invoice ${res.extracted.invoiceId} sent to ${m.displayName}`);
      }
    } catch (err) {
      log(`invoice for ${m.displayName} failed: ${(err as Error).message}`);
    }
  }
}
