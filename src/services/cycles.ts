// Opening a cycle: contributions become due; members without a saved wallet get a PayPal invoice.
import type { PrismaClient } from "@prisma/client";
import { gateFor, loadCircle } from "./gate-context";
import { setCycleState } from "./settlement";

export async function openCycle(db: PrismaClient, circleId: string, cycleNumber: number, log: (m: string) => void = () => {}) {
  const { circle, body } = await loadCircle(db, circleId);
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
