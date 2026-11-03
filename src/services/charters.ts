// Charters: drafted by the Treasurer, validated by code, frozen once every member approves.
import type { Prisma, PrismaClient } from "@prisma/client";
import { draftAmendment, draftCharter } from "@/agents/treasurer";
import { applyChanges, validateCharter, type CharterBody } from "@/domain/charter";
import { hashObject } from "@/gate/hashing";
import { now } from "@/domain/clock";
import { loadCircle } from "./gate-context";

export async function charterFromText(text: string, members: number) {
  const r = await draftCharter(text);
  if (r.quarantined) return { ok: false, body: null, problems: [`quarantined: ${r.reasons.join(", ")}`], questions: [] as string[] };
  const { body, problems } = validateCharter({ ...r.draft, members });
  return { ok: problems.length === 0, body: body as CharterBody | null, problems, questions: r.draft.clarifyingQuestions };
}

export async function createCircle(
  db: PrismaClient,
  args: { name: string; body: CharterBody; members: { displayName: string; email: string; vaultId?: string | null; city?: string }[] },
  opts: { mode?: "live" | "simulated"; clock?: { secondsPerDay: number; startedAt: Date } } = {},
) {
  const day = 86_400_000;
  const cadenceDays = args.body.cadence === "weekly" ? 7 : 30;
  const circle = await db.circle.create({
    data: { name: args.name, mode: opts.mode ?? "live", secondsPerDay: opts.clock?.secondsPerDay ?? null, clockStartedAt: opts.clock?.startedAt ?? null },
  });
  const body = { ...args.body, members: args.members.length, label: `${args.name} ${new Date().toISOString()}` };
  const charter = await db.charter.create({
    data: { circleId: circle.id, version: 1, hash: hashObject(body), body: body as unknown as Prisma.InputJsonValue, frozen: false, approvals: [] },
  });
  const members = [];
  for (const m of args.members) {
    members.push(await db.member.create({ data: { circleId: circle.id, displayName: m.displayName, paypalEmail: m.email, vaultId: m.vaultId ?? null, city: m.city ?? null } }));
  }
  const start = (opts.clock?.startedAt ?? now()).getTime();
  for (let k = 1; k <= args.members.length; k++) {
    await db.cycle.create({ data: { circleId: circle.id, number: k, dueAt: new Date(start + k * cadenceDays * day), state: "pending" } });
  }
  return { circle, charter, members };
}

// Freezes the charter once every member has approved it.
export async function approveCharter(db: PrismaClient, charterId: string, memberId: string) {
  const c = await db.charter.findUniqueOrThrow({ where: { id: charterId } });
  const approvals = new Set((c.approvals as string[]) ?? []);
  approvals.add(memberId);
  const memberCount = await db.member.count({ where: { circleId: c.circleId } });
  const frozen = approvals.size >= memberCount;
  return db.charter.update({ where: { id: charterId }, data: { approvals: [...approvals], frozen } });
}

// "Can we add my cousin mid-cycle?" -> explanation + a draft amendment that needs every approval.
export async function requestAmendment(db: PrismaClient, circleId: string, memberId: string, text: string) {
  const { charter, body } = await loadCircle(db, circleId);
  const r = await draftAmendment(body, text);
  if (r.quarantined) return { created: false as const, explanation: `Request quarantined (${r.reasons.join(", ")}).` };
  const a = r.amendment;
  if (a.changes.length === 0) return { created: false as const, explanation: a.explanation };

  const { body: newBody, problems } = validateCharter(applyChanges(body, a.changes));
  if (problems.length) return { created: false as const, explanation: `${a.explanation} (Not valid: ${problems.join("; ")})` };

  const versioned = { ...newBody, label: `${body.label ?? circleId} v${charter.version + 1}`, request: text, requestedBy: memberId, note: a.explanation };
  const draft = await db.charter.create({
    data: {
      circleId,
      version: charter.version + 1,
      hash: hashObject(versioned),
      body: versioned as unknown as Prisma.InputJsonValue,
      frozen: false,
      approvals: [memberId],
    },
  });
  return { created: true as const, explanation: a.explanation, conflictsWith: a.conflictsWith, draftCharterId: draft.id };
}
