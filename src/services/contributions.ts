// Marks a contribution paid and posts its ledger entry. Safe to call twice (API response + webhook).
import type { PrismaClient } from "@prisma/client";
import { contributionEntry } from "@/domain/ledger";
import { contributionRequestId, postEntry } from "./ledger-store";

export async function recordPaid(
  db: PrismaClient,
  contributionId: string,
  opts: { captureId?: string; vaultId?: string; paypalId?: string } = {},
) {
  const c = await db.contribution.findUniqueOrThrow({ where: { id: contributionId } });
  if (c.status !== "paid") {
    await db.contribution.update({
      where: { id: c.id },
      data: { status: "paid", paidAt: new Date(), captureId: opts.captureId ?? c.captureId },
    });
  }
  if (opts.vaultId) await db.member.update({ where: { id: c.memberId }, data: { vaultId: opts.vaultId } });
  const { posted } = await postEntry(db, c.circleId, {
    ...contributionEntry(c.memberId, c.cycleNumber, c.amountCents, opts.paypalId ?? opts.captureId ?? c.captureId ?? undefined),
    requestId: contributionRequestId(c.circleId, c.cycleNumber, c.memberId),
  });
  return { circleId: c.circleId, captureId: opts.captureId ?? c.captureId ?? undefined, posted };
}
