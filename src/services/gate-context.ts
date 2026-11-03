// Builds the gate's view of a circle from the database, plus the audit sink and member directory.
import type { Prisma, PrismaClient } from "@prisma/client";
import type { GateContext, Proposal } from "@/gate/policy";
import { execute, type AuditSink, type ExecResult, type MemberDirectory } from "@/gate/executor";
import { accounts } from "@/domain/ledger";
import { loadBalances } from "./ledger-store";

export interface CharterBody {
  contributionCents: number;
  members: number;
  depositOn: boolean;
  turnMode?: string;
  defaultSteps?: { graceDays: number; cureHours: number };
  preauthLeadDays?: number;
}

export async function loadCircle(db: PrismaClient, circleId: string) {
  const circle = await db.circle.findUniqueOrThrow({
    where: { id: circleId },
    include: {
      members: { orderBy: { id: "asc" } },
      charters: { where: { frozen: true }, orderBy: { version: "desc" }, take: 1 },
      cycles: { orderBy: { number: "asc" } },
    },
  });
  const charter = circle.charters[0];
  if (!charter) throw new Error(`Circle ${circleId} has no approved charter`);
  return { circle, charter, body: charter.body as unknown as CharterBody };
}

export function auditSink(db: PrismaClient, circleId: string, charterHash: string, model?: string): AuditSink {
  return {
    async record(row) {
      await db.auditLog.create({
        data: {
          circleId,
          agent: row.agent,
          model: model ?? null,
          proposal: row.proposal as unknown as Prisma.InputJsonValue,
          allowed: row.allowed,
          reasons: row.reasons,
          requestId: row.requestId,
          paypalId: row.paypalId ?? null,
          charterHash,
        },
      });
    },
  };
}

export async function gateFor(db: PrismaClient, circleId: string, cycleNumber: number, agent = "system", model?: string) {
  const { circle, charter, body } = await loadCircle(db, circleId);
  const cycle = circle.cycles.find((c) => c.number === cycleNumber);
  if (!cycle) throw new Error(`Cycle ${cycleNumber} not found`);

  const memberIds = circle.members.map((m) => m.id);
  const bal = await loadBalances(db, circleId);
  const potCollected = Math.max(0, -(bal.get(accounts.pot(cycleNumber)) ?? 0));

  const mandates: GateContext["mandates"] = {};
  const mandateRows = await db.mandate.findMany({ where: { memberId: { in: memberIds } }, orderBy: { createdAt: "desc" } });
  for (const m of mandateRows) {
    if (mandates[m.memberId]) continue; // newest first
    const b = m.body as { maxDiscountCents?: number };
    mandates[m.memberId] = { hash: m.hash, maxDiscount: b.maxDiscountCents ?? 0, revoked: m.revoked };
  }

  const paid = await db.contribution.findMany({ where: { circleId, cycleNumber, status: "paid" }, select: { memberId: true } });
  const executed = await db.auditLog.findMany({ where: { circleId, allowed: true, requestId: { not: null } }, select: { requestId: true } });

  const ctx: GateContext = {
    charter: { hash: charter.hash, frozen: charter.frozen, contribution: body.contributionCents, memberIds, depositOn: body.depositOn },
    cycle: { number: cycle.number, state: cycle.state as GateContext["cycle"]["state"], potCollected },
    mandates,
    ladder: {}, // filled by the default-steps job (Stage 4)
    deposits: Object.fromEntries(circle.members.map((m) => [m.id, m.depositCents])),
    executedRequestIds: new Set(executed.map((e) => e.requestId).filter((x): x is string => Boolean(x))),
    paidThisCycle: new Set(paid.map((p) => p.memberId)),
  };

  const byId = new Map(circle.members.map((m) => [m.id, m]));
  const members: MemberDirectory = {
    email: (id) => {
      const m = byId.get(id);
      if (!m) throw new Error(`Unknown member ${id}`);
      return m.paypalEmail;
    },
    vaultId: (id) => byId.get(id)?.vaultId ?? undefined,
  };
  const audit = auditSink(db, circleId, charter.hash, model);

  return {
    ctx,
    body,
    charterHash: charter.hash,
    run: (p: Proposal): Promise<ExecResult> => execute(agent, p, ctx, members, audit),
  };
}
