// Member pay-ins: create an order (saving the wallet the first time), then capture after approval.
import type { PrismaClient } from "@prisma/client";
import { gateFor } from "./gate-context";
import { recordPaid } from "./contributions";

export type StartPayinResult =
  | { alreadyPaid: true }
  | { alreadyPaid: false; orderId: string; approveUrl: string };

export async function startPayin(
  db: PrismaClient,
  circleId: string,
  memberId: string,
  cycleNumber: number,
  urls: { returnUrl: string; cancelUrl: string },
): Promise<StartPayinResult> {
  const key = { memberId_cycleNumber: { memberId, cycleNumber } };
  const existing = await db.contribution.findUnique({ where: key });
  if (existing?.status === "paid") return { alreadyPaid: true };
  if (existing?.status === "pending" && existing.orderId && existing.approveUrl) {
    return { alreadyPaid: false, orderId: existing.orderId, approveUrl: existing.approveUrl };
  }

  const g = await gateFor(db, circleId, cycleNumber, "member");
  const res = await g.run({
    kind: "create_payin",
    circleId,
    cycle: cycleNumber,
    charterHash: g.charterHash,
    memberId,
    amount: g.body.contributionCents,
    ...urls,
  });
  const { orderId, approveUrl } = res.extracted;
  if (!res.allowed || !orderId || !approveUrl) {
    throw new Error(`Pay-in refused: ${res.reasons.join("; ") || "PayPal returned no approval link"}`);
  }

  const data = { orderId, approveUrl, status: "pending", method: "payin_order" };
  await db.contribution.upsert({
    where: key,
    create: { circleId, memberId, cycleNumber, amountCents: g.body.contributionCents, ...data },
    update: data,
  });
  return { alreadyPaid: false, orderId, approveUrl };
}

export async function completePayin(db: PrismaClient, orderId: string) {
  const c = await db.contribution.findUnique({ where: { orderId } });
  if (!c) throw new Error(`No contribution for order ${orderId}`);
  if (c.status === "paid") return { circleId: c.circleId, captureId: c.captureId ?? undefined, alreadyPaid: true };

  const g = await gateFor(db, c.circleId, c.cycleNumber, "member");
  const res = await g.run({ kind: "capture_payin", circleId: c.circleId, cycle: c.cycleNumber, charterHash: g.charterHash, memberId: c.memberId, orderId });
  if (!res.allowed) throw new Error(`Capture refused: ${res.reasons.join("; ")}`);

  const paid = await recordPaid(db, c.id, { captureId: res.extracted.captureId, vaultId: res.extracted.vaultId });
  return { ...paid, alreadyPaid: false };
}
