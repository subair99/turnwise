// Read models for the charter, mandate, trust and passport screens.
import type { PrismaClient } from "@prisma/client";
import { settle } from "@/domain/auction";
import { depositRequired } from "@/domain/deposits";
import type { CharterBody } from "@/domain/charter";
import { loadBalances } from "./ledger-store";
import { payoutOwedAccount } from "./payout-watch";
import { memberToken } from "./member-token";

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0 })}`;

export function rulesInWords(b: CharterBody): string[] {
  const per = b.cadence === "weekly" ? "week" : "month";
  return [
    `Each member pays ${usd(b.contributionCents)} every ${per}. The whole pot goes to one member each cycle.`,
    b.turnMode === "auction"
      ? "Turns go by sealed auction: the member who offers the biggest discount within their mandate collects, and the discount is shared with everyone else."
      : b.turnMode === "lottery"
        ? "Turns are drawn by lot among members who haven't collected."
        : "Turns follow a fixed order agreed at the start.",
    b.depositOn
      ? "Whoever collects leaves one contribution behind as a deposit. It is returned when they finish the circle."
      : "There is no deposit.",
    `Each payment is authorized from the member's saved PayPal wallet ${b.preauthLeadDays} days before it is due and taken on the due date.`,
    `If a payment is missed: a reminder on the due date, ${b.defaultSteps.graceDays} grace days, a ${b.defaultSteps.cureHours}-hour window to pay, then the deposit is used. If more is still owed, members vote (${Math.round(b.voteQuorum * 100)}% needed).`,
    "The rules change only if every member approves.",
  ];
}

const FIELD_LABEL: Record<string, string> = {
  contributionCents: "Contribution",
  members: "Members",
  depositOn: "Deposit",
  turnMode: "Turns",
  cadence: "How often",
  preauthLeadDays: "Days authorized early",
  voteQuorum: "Vote needed",
};

function diff(a: CharterBody, b: CharterBody) {
  const out: { field: string; from: string; to: string }[] = [];
  const show = (k: string, v: unknown) => (k === "contributionCents" ? usd(Number(v)) : k === "depositOn" ? (v ? "On" : "Off") : k === "voteQuorum" ? `${Math.round(Number(v) * 100)}%` : String(v));
  for (const k of Object.keys(FIELD_LABEL)) {
    const x = (a as unknown as Record<string, unknown>)[k];
    const y = (b as unknown as Record<string, unknown>)[k];
    if (x !== y) out.push({ field: FIELD_LABEL[k]!, from: show(k, x), to: show(k, y) });
  }
  if (a.defaultSteps.graceDays !== b.defaultSteps.graceDays) out.push({ field: "Grace days", from: String(a.defaultSteps.graceDays), to: String(b.defaultSteps.graceDays) });
  if (a.defaultSteps.cureHours !== b.defaultSteps.cureHours) out.push({ field: "Window to pay (hours)", from: String(a.defaultSteps.cureHours), to: String(b.defaultSteps.cureHours) });
  return out;
}

export async function membersOf(db: PrismaClient, circleId: string) {
  const ms = await db.member.findMany({ where: { circleId }, orderBy: { id: "asc" } });
  return ms.map((m) => ({ id: m.id, name: m.displayName }));
}

export async function charterView(db: PrismaClient, circleId: string) {
  const [charters, members] = await Promise.all([
    db.charter.findMany({ where: { circleId }, orderBy: { version: "asc" } }),
    db.member.findMany({ where: { circleId }, orderBy: { id: "asc" } }),
  ]);
  const name = new Map(members.map((m) => [m.id, m.displayName]));
  const active = [...charters].reverse().find((c) => c.frozen) ?? charters[0];
  if (!active) return null;
  const activeBody = active.body as unknown as CharterBody;
  const drafts = charters
    .filter((c) => !c.frozen && c.version > active.version)
    .map((c) => {
      const body = c.body as unknown as CharterBody & { request?: string; requestedBy?: string; note?: string };
      const approvals = (c.approvals as string[]) ?? [];
      return {
        id: c.id,
        version: c.version,
        hash: c.hash,
        request: body.request ?? "",
        requestedBy: body.requestedBy ? name.get(body.requestedBy) ?? "" : "",
        note: body.note ?? "",
        changes: diff(activeBody, body),
        approvedBy: approvals.map((id) => name.get(id) ?? id),
        approvalIds: approvals,
        everyone: approvals.length >= members.length,
      };
    })
    .reverse();
  return {
    version: active.version,
    hash: active.hash,
    approvedBy: ((active.approvals as string[]) ?? []).length,
    members: members.length,
    rules: rulesInWords(activeBody),
    drafts,
  };
}

export async function mandateView(db: PrismaClient, circleId: string, memberId: string) {
  const member = await db.member.findFirst({ where: { id: memberId, circleId }, include: { circle: true } });
  if (!member) return null;
  const mandate = await db.mandate.findFirst({ where: { memberId }, orderBy: { createdAt: "desc" } });
  const bids = await db.bid.findMany({ where: { memberId }, include: { cycle: true }, orderBy: { placedAt: "desc" }, take: 12 });
  const body = mandate?.body as { maxDiscountCents?: number; deadline?: string | null; targetCents?: number | null; notes?: string[] } | undefined;
  return {
    member: { id: member.id, name: member.displayName, collectedCycle: member.collectedCycle },
    live: member.circle.mode === "live",
    mandate: mandate
      ? {
          capCents: body?.maxDiscountCents ?? 0,
          deadline: body?.deadline ?? null,
          notes: body?.notes ?? [],
          sourceText: mandate.sourceText,
          hash: mandate.hash,
          revoked: mandate.revoked,
          createdAt: mandate.createdAt.toISOString(),
        }
      : null,
    token: member.circle.mode === "live" ? memberToken(circleId, member.id) : null,
    bids: bids.map((b) => ({
      id: b.id,
      cycle: b.cycle.number,
      sealed: b.cycle.state !== "closed" && b.accepted,
      discountCents: b.discountCents,
      source: b.source === "mcp" ? "Outside assistant" : "Turn Agent",
      accepted: b.accepted,
      reason: b.gateReason ?? "",
    })),
  };
}

export interface AuditRow {
  id: string;
  time: string;
  agent: string;
  action: string;
  member: string;
  cycle: number | null;
  decision: "Allowed" | "Refused";
  reasons: string;
  model: string;
  paypalId: string;
  requestId: string;
}

const ACTION: Record<string, string> = {
  create_payin: "Start a pay-in",
  capture_payin: "Take a pay-in",
  send_invoice: "Send an invoice",
  create_preauth: "Authorize a payment",
  capture_preauth: "Take an authorized payment",
  void_preauth: "Cancel an authorization",
  payout_batch: "Pay out the pot",
  accept_bid: "Accept a bid",
  apply_deposit: "Use a deposit",
  refund_deposit: "Return a deposit",
  repay_owed: "Send a held payout again",
  revoke_mandate: "Stop a Turn Agent",
  approve_amendment: "Approve a change",
  reconcile: "Check the ledger against PayPal",
};

export async function trustView(db: PrismaClient, circleId: string) {
  const [members, audits, bids] = await Promise.all([
    db.member.findMany({ where: { circleId }, orderBy: { id: "asc" }, include: { mandates: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    db.auditLog.findMany({ where: { circleId }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.bid.findMany({ where: { cycle: { circleId } } }),
  ]);
  const name = new Map(members.map((m) => [m.id, m.displayName]));
  const meters = members.map((m) => {
    const mandate = m.mandates[0];
    const cap = (mandate?.body as { maxDiscountCents?: number } | undefined)?.maxDiscountCents ?? 0;
    const mine = bids.filter((b) => b.memberId === m.id);
    const highest = Math.max(0, ...mine.filter((b) => b.accepted).map((b) => b.discountCents));
    return {
      id: m.id,
      name: m.displayName,
      hasMandate: Boolean(mandate),
      collected: m.collectedCycle !== null,
      revoked: mandate?.revoked ?? false,
      capCents: cap,
      highestCents: highest,
      rejected: mine.filter((b) => !b.accepted).length,
    };
  });
  const rows: AuditRow[] = audits.map((a) => {
    const p = a.proposal as { kind?: string; memberId?: string; cycle?: number; items?: { memberId: string }[] };
    return {
      id: a.id,
      time: a.createdAt.toISOString(),
      agent: a.agent,
      action: ACTION[p.kind ?? ""] ?? p.kind ?? "",
      member: p.memberId ? name.get(p.memberId) ?? "" : p.items ? `${p.items.length} members` : "",
      cycle: typeof p.cycle === "number" ? p.cycle : null,
      decision: a.allowed ? "Allowed" : "Refused",
      reasons: ((a.reasons as string[]) ?? []).join("; "),
      model: a.model ?? "",
      paypalId: a.paypalId ?? "",
      requestId: a.requestId ?? "",
    };
  });
  return { meters, rows, allowed: rows.filter((r) => r.decision === "Allowed").length, refused: rows.filter((r) => r.decision === "Refused").length };
}

export async function owedPayouts(db: PrismaClient, circleId: string) {
  const [members, batches, circle] = await Promise.all([
    db.member.findMany({ where: { circleId }, orderBy: { id: "asc" } }),
    db.payoutBatch.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } }),
    db.circle.findUniqueOrThrow({ where: { id: circleId } }),
  ]);
  if (circle.mode !== "live") return [];
  const bal = await loadBalances(db, circleId);
  return members
    .map((m) => {
      const owed = -(bal.get(payoutOwedAccount(m.id)) ?? 0);
      const lastFailure = batches.flatMap((b) => (b.failures as { memberId: string; reason: string }[]) ?? []).find((f) => f.memberId === m.id);
      const waiting = batches.some((b) => b.purpose === "retry" && b.status === "pending" && (b.items as { memberId: string }[]).some((i) => i.memberId === m.id));
      return { id: m.id, name: m.displayName, owedCents: owed, reason: lastFailure?.reason ?? "", waiting };
    })
    .filter((x) => x.owedCents > 0);
}

export async function passportView(db: PrismaClient, circleId: string) {
  const c = await db.circle.findUniqueOrThrow({
    where: { id: circleId },
    include: { members: { orderBy: { id: "asc" } }, cycles: { orderBy: { number: "asc" } }, charters: { where: { frozen: true }, orderBy: { version: "desc" }, take: 1 } },
  });
  const body = c.charters[0]?.body as unknown as CharterBody | undefined;
  const [contribs, refunds, rec] = await Promise.all([
    db.contribution.findMany({ where: { circleId } }),
    db.ledgerEntry.findMany({ where: { circleId, description: { startsWith: "Deposit refunded to " } } }),
    db.auditLog.findFirst({ where: { circleId, agent: "reconciler" }, orderBy: { createdAt: "desc" } }),
  ]);
  const memberIds = c.members.map((m) => m.id);
  const passports = c.members.map((m) => {
    const mine = contribs.filter((k) => k.memberId === m.id);
    const onTime = mine.filter((k) => k.status === "paid" && k.ladderStep === "current").length;
    const late = mine.filter((k) => k.status === "paid" && k.ladderStep !== "current").length;
    const missed = mine.filter((k) => k.status === "covered" || k.status === "shortfall");
    const settled = onTime + late + missed.length;
    const cycle = m.collectedCycle ? c.cycles.find((x) => x.number === m.collectedCycle) : undefined;
    const payout = cycle && body
      ? settle({ contribution: body.contributionCents, memberIds, winnerId: m.id, discount: cycle.discountCents ?? 0, depositOn: depositRequired(cycle.number, c.cycles.length, body.depositOn) }).winnerPayout
      : null;
    const refunded = refunds.some((e) => e.description === `Deposit refunded to ${m.id}`);
    const deposit = m.depositCents > 0
      ? `${usd(m.depositCents)} held, returned when they finish`
      : refunded
        ? "Returned at the end of the circle"
        : missed[0]
          ? `Used to cover cycle ${missed[0].cycleNumber}`
          : m.collectedCycle
            ? "None needed"
            : "Not collected yet";
    return {
      id: m.id,
      name: m.displayName,
      city: m.city ?? "",
      record: settled ? `${onTime} of ${settled} paid on time` : "No payments due yet",
      late,
      missed: missed.length,
      collected: cycle ? `Collected cycle ${cycle.number}: ${usd(payout ?? 0)}${cycle.discountCents ? ` after a ${usd(cycle.discountCents)} discount` : ""}` : "Still waiting for their turn",
      deposit,
    };
  });
  const r = rec?.proposal as { checked?: number; driftCents?: number; unverified?: number } | undefined;
  return {
    mode: c.mode,
    status: c.status,
    charterHash: c.charters[0]?.hash ?? "",
    reconciliation: rec ? { at: rec.createdAt.toISOString(), checked: r?.checked ?? 0, driftCents: r?.driftCents ?? 0, unverified: r?.unverified ?? 0 } : null,
    passports,
  };
}
