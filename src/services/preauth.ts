// Pre-authorized contributions: authorize 5 days before the due date (vaulted wallet, no member present),
// capture on the due date. PayPal authorizations expire after 29 days, so each contribution gets its own.
import type { PrismaClient } from "@prisma/client";
import { gateFor } from "./gate-context";
import { recordPaid } from "./contributions";

export async function preauthorize(db: PrismaClient, circleId: string, memberId: string, cycleNumber: number) {
  const key = { memberId_cycleNumber: { memberId, cycleNumber } };
  const existing = await db.preAuthorization.findUnique({ where: key });
  if (existing && ["authorized", "captured"].includes(existing.status)) return { ...existing, approveUrl: undefined };

  const g = await gateFor(db, circleId, cycleNumber, "guardian");
  const res = await g.run({ kind: "create_preauth", circleId, cycle: cycleNumber, charterHash: g.charterHash, memberId, amount: g.body.contributionCents });
  if (!res.allowed) throw new Error(`Pre-authorization refused: ${res.reasons.join("; ")}`);

  const e = res.extracted;
  const data = {
    orderId: e.orderId ?? null,
    authorizationId: e.authorizationId ?? null,
    amountCents: g.body.contributionCents,
    status: e.authorizationId ? "authorized" : "pending_approval",
    expiresAt: e.expiresAt ? new Date(e.expiresAt) : null,
  };
  const pre = await db.preAuthorization.upsert({ where: key, create: { memberId, cycleNumber, ...data }, update: data });

  await db.contribution.upsert({
    where: key,
    create: {
      circleId,
      memberId,
      cycleNumber,
      amountCents: g.body.contributionCents,
      method: "preauth",
      status: "preauthorized",
      approveUrl: e.approveUrl ?? null,
    },
    update: { method: "preauth", status: "preauthorized", approveUrl: e.approveUrl ?? null },
  });
  return { ...pre, approveUrl: e.approveUrl };
}

export async function captureDue(db: PrismaClient, circleId: string, memberId: string, cycleNumber: number) {
  const key = { memberId_cycleNumber: { memberId, cycleNumber } };
  const pre = await db.preAuthorization.findUnique({ where: key });
  if (!pre?.authorizationId || pre.status !== "authorized") throw new Error(`No live authorization for ${memberId}, cycle ${cycleNumber}`);
  if (pre.expiresAt && pre.expiresAt.getTime() < Date.now()) {
    await db.preAuthorization.update({ where: { id: pre.id }, data: { status: "expired" } });
    throw new Error("Authorization expired; start the default steps");
  }

  const g = await gateFor(db, circleId, cycleNumber, "guardian");
  const res = await g.run({
    kind: "capture_preauth",
    circleId,
    cycle: cycleNumber,
    charterHash: g.charterHash,
    memberId,
    authorizationId: pre.authorizationId,
    amount: pre.amountCents,
  });
  if (!res.allowed) throw new Error(`Capture refused: ${res.reasons.join("; ")}`);

  await db.preAuthorization.update({ where: { id: pre.id }, data: { status: "captured" } });
  const c = await db.contribution.findUniqueOrThrow({ where: key });
  return recordPaid(db, c.id, { captureId: res.extracted.captureId });
}

export async function voidPreauth(db: PrismaClient, circleId: string, memberId: string, cycleNumber: number) {
  const key = { memberId_cycleNumber: { memberId, cycleNumber } };
  const pre = await db.preAuthorization.findUnique({ where: key });
  if (!pre?.authorizationId || pre.status !== "authorized") return { voided: false };
  const g = await gateFor(db, circleId, cycleNumber, "guardian");
  const res = await g.run({ kind: "void_preauth", circleId, cycle: cycleNumber, charterHash: g.charterHash, memberId, authorizationId: pre.authorizationId });
  if (!res.allowed) throw new Error(`Void refused: ${res.reasons.join("; ")}`);
  await db.preAuthorization.update({ where: { id: pre.id }, data: { status: "voided" } });
  return { voided: true };
}
