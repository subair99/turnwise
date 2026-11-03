// Member decisions: approving a proposed change, stopping a Turn Agent. Each is recorded in the audit log.
import type { Prisma, PrismaClient } from "@prisma/client";
import { revokeMandate } from "./mandates";
import { notice } from "./notices";

// Records one member's approval of a proposed change. A change approved by everyone applies from the next circle,
// so the rules of a circle already running never move under it.
export async function approveAmendment(db: PrismaClient, charterId: string, memberId: string) {
  const c = await db.charter.findUniqueOrThrow({ where: { id: charterId } });
  if (c.frozen) return { approvals: (c.approvals as string[]).length, everyone: true };
  const approvals = new Set((c.approvals as string[]) ?? []);
  approvals.add(memberId);
  await db.charter.update({ where: { id: charterId }, data: { approvals: [...approvals] } });
  const members = await db.member.count({ where: { circleId: c.circleId } });
  await audit(db, c.circleId, memberId, { kind: "approve_amendment", charterVersion: c.version });
  if (approvals.size >= members) {
    await notice(db, { circleId: c.circleId, kind: "info", text: `Every member approved charter version ${c.version}. It applies from the next circle.` });
  }
  return { approvals: approvals.size, everyone: approvals.size >= members };
}

export async function stopTurnAgent(db: PrismaClient, circleId: string, memberId: string) {
  const r = await revokeMandate(db, memberId);
  const m = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  await audit(db, circleId, memberId, { kind: "revoke_mandate" });
  await notice(db, { circleId, memberId, kind: "info", text: `${m.displayName} stopped their Turn Agent. Any bid it makes from now on is refused by the gate.` });
  return r.count;
}

async function audit(db: PrismaClient, circleId: string, memberId: string, proposal: Record<string, unknown>) {
  await db.auditLog.create({
    data: { circleId, agent: "member", proposal: { ...proposal, memberId } as unknown as Prisma.InputJsonValue, allowed: true, reasons: [] },
  });
}
