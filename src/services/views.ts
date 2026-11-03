// Read models for the UI. Everything shown comes from the database the gate and worker write to.
import type { PrismaClient } from "@prisma/client";
import { settle } from "@/domain/auction";
import { depositRequired } from "@/domain/deposits";
import type { CharterBody } from "@/domain/charter";
import { circleNow } from "@/domain/clock";
import { accounts, type Posting } from "@/domain/ledger";

const RULES: Record<string, string> = {
  create_payin: "A pay-in equals one contribution, only while the cycle is collecting",
  capture_payin: "Capture the member's approved pay-in once",
  send_invoice: "An invoice equals one contribution",
  create_preauth: "Authorize from the saved wallet before the due date (charter lead days)",
  capture_preauth: "Capture on the due date, never more than one contribution",
  payout_batch: "Pay out no more than the collected pot, to members only",
  apply_deposit: "Use a deposit only after the reminder, grace days and cure window",
  refund_deposit: "Return the deposit once the member has finished the circle",
  accept_bid: "A bid must be within the member's mandate cap",
};

export interface LedgerRow {
  id: string;
  date: string;
  cycle: number;
  member: string;
  city: string;
  type: string;
  direction: "In" | "Out" | "Held" | "Applied" | "Returned";
  amount: number; // dollars
  timing: string;
  status: string;
  method: string;
  agent: string;
  model: string;
  rule: string;
  charterHash: string;
  paypalId: string;
  requestId: string;
  gate: string;
}

export interface BidRow {
  id: string;
  cycle: string;
  member: string;
  source: string;
  discount: number | null; // null while sealed
  gate: "passed" | "rejected";
  reason: string;
  explanation: string;
  placedAt: string;
  result: string;
}

export async function circleHeader(db: PrismaClient, id: string) {
  const c = await db.circle.findUnique({
    where: { id },
    include: { charters: { orderBy: { version: "desc" } }, _count: { select: { members: true } } },
  });
  if (!c) return null;
  const charter = c.charters.find((x) => x.frozen) ?? c.charters[0];
  const body = charter?.body as unknown as CharterBody | undefined;
  return {
    id: c.id,
    name: c.name,
    mode: c.mode,
    status: c.status,
    members: c._count.members,
    contributionCents: body?.contributionCents ?? 0,
    cadence: body?.cadence ?? "monthly",
    turnMode: body?.turnMode ?? "auction",
    secondsPerDay: c.secondsPerDay,
    charterHash: charter?.hash ?? "",
    frozen: charter?.frozen ?? false,
  };
}

export async function circleHome(db: PrismaClient, id: string) {
  const c = await db.circle.findUniqueOrThrow({
    where: { id },
    include: {
      members: { orderBy: { id: "asc" } },
      cycles: { orderBy: { number: "asc" } },
      charters: { where: { frozen: true }, orderBy: { version: "desc" }, take: 1 },
      notices: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  const body = c.charters[0]?.body as unknown as CharterBody | undefined;
  const contribution = body?.contributionCents ?? 0;
  const open = c.cycles.find((x) => x.state !== "closed") ?? null;
  const contribs = open ? await db.contribution.findMany({ where: { circleId: id, cycleNumber: open.number } }) : [];
  const byMember = new Map(contribs.map((x) => [x.memberId, x]));
  const at = circleNow(c);
  const covered = await db.contribution.findMany({ where: { circleId: id, status: "covered" }, select: { memberId: true, cycleNumber: true } });
  const usedIn = new Map(covered.map((x) => [x.memberId, x.cycleNumber]));
  return {
    at: at.toISOString(),
    potCents: contribution * c.members.length,
    turnMode: body?.turnMode ?? "auction",
    totalCycles: c.cycles.length,
    open: open ? { number: open.number, state: open.state, dueAt: open.dueAt.toISOString() } : null,
    closedCycles: c.cycles.filter((x) => x.state === "closed").length,
    members: c.members.map((m) => {
      const k = byMember.get(m.id);
      return {
        id: m.id,
        name: m.displayName,
        city: m.city ?? "",
        collectedCycle: m.collectedCycle,
        depositCents: m.depositCents,
        depositUsedCycle: usedIn.get(m.id) ?? null,
        walletSaved: Boolean(m.vaultId),
        thisCycle: k ? contributionLabel(k.status, k.ladderStep) : "",
      };
    }),
    paidThisCycle: contribs.filter((x) => x.status === "paid" || x.status === "covered").length,
    authorizedThisCycle: contribs.filter((x) => x.status === "preauthorized").length,
    depositsHeldCents: c.members.reduce((s, m) => s + m.depositCents, 0),
    notices: c.notices.map((n) => ({ id: n.id, kind: n.kind, text: n.text, cycle: n.cycleNumber, at: n.createdAt.toISOString() })),
  };
}

function contributionLabel(status: string, step: string) {
  switch (status) {
    case "paid":
      return step === "current" ? "Paid on time" : "Paid late";
    case "covered":
      return "Missed: deposit used";
    case "shortfall":
      return "Missed: vote needed";
    case "preauthorized":
      return "Authorized";
    case "failed":
      return "Payment failed";
    default:
      return step === "current" ? "Due" : step === "reminded" ? "Overdue: reminded" : step === "cure" ? "Overdue: cure window" : "Due";
  }
}

export async function ledgerRows(db: PrismaClient, id: string): Promise<LedgerRow[]> {
  const c = await db.circle.findUniqueOrThrow({
    where: { id },
    include: { members: { orderBy: { id: "asc" } }, cycles: { orderBy: { number: "asc" } }, charters: { where: { frozen: true }, orderBy: { version: "desc" }, take: 1 } },
  });
  const body = c.charters[0]?.body as unknown as CharterBody | undefined;
  const charterHash = c.charters[0]?.hash ?? "";
  const simulated = c.mode === "simulated";
  const [contribs, audits, batches, entries] = await Promise.all([
    db.contribution.findMany({ where: { circleId: id } }),
    db.auditLog.findMany({ where: { circleId: id }, orderBy: { createdAt: "asc" } }),
    db.payoutBatch.findMany({ where: { circleId: id } }),
    db.ledgerEntry.findMany({ where: { circleId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  const name = new Map(c.members.map((m) => [m.id, m.displayName]));
  const city = new Map(c.members.map((m) => [m.id, m.city ?? ""]));
  const byPaypal = new Map(audits.filter((a) => a.paypalId).map((a) => [a.paypalId!, a]));
  const byKey = new Map<string, (typeof audits)[number]>();
  for (const a of audits) {
    const p = a.proposal as { kind?: string; memberId?: string; cycle?: number };
    if (a.allowed) byKey.set(`${p.kind}|${p.memberId ?? ""}|${p.cycle ?? ""}`, a);
  }
  const auditOf = (paypalId: string | null | undefined, keys: string[]) => (paypalId ? byPaypal.get(paypalId) : undefined) ?? keys.map((k) => byKey.get(k)).find(Boolean);
  const auditFields = (a: (typeof audits)[number] | undefined, fallbackKind: string) => {
    const kind = ((a?.proposal as { kind?: string } | undefined)?.kind ?? fallbackKind) as string;
    return {
      agent: a?.agent ?? "",
      model: a?.model ?? (simulated ? "simulated" : ""),
      rule: RULES[kind] ?? "",
      charterHash: a?.charterHash ?? charterHash,
      requestId: a?.requestId ?? "",
      gate: a ? (a.allowed ? "Allowed" : `Refused: ${(a.reasons as string[]).join("; ")}`) : "",
    };
  };
  const rows: LedgerRow[] = [];

  for (const k of contribs) {
    const paypalId = k.captureId ?? k.invoiceId ?? k.orderId ?? "";
    const kind = k.method === "preauth" ? "capture_preauth" : k.method === "invoice" ? "send_invoice" : "capture_payin";
    const a = auditOf(paypalId, [`${kind}|${k.memberId}|${k.cycleNumber}`, `capture_payin|${k.memberId}|${k.cycleNumber}`, `create_preauth|${k.memberId}|${k.cycleNumber}`]);
    const timing = k.status === "paid" ? (k.ladderStep === "current" ? "On time" : "Late") : k.status === "covered" ? "Missed: deposit used" : k.status === "shortfall" ? "Missed: vote needed" : "Not yet due";
    rows.push({
      id: `contribution:${k.id}`,
      date: (k.paidAt ?? k.createdAt).toISOString(),
      cycle: k.cycleNumber,
      member: name.get(k.memberId) ?? "",
      city: city.get(k.memberId) ?? "",
      type: "Contribution",
      direction: "In",
      amount: k.amountCents / 100,
      timing,
      status: contributionLabel(k.status, k.ladderStep),
      method: k.method === "preauth" ? "Pre-authorized" : k.method === "invoice" ? "Invoice" : k.method === "payin_order" ? "PayPal checkout" : "",
      paypalId: simulated ? "" : paypalId,
      ...auditFields(a, kind),
    });
    if (k.status === "covered") {
      const da = auditOf(null, [`apply_deposit|${k.memberId}|${k.cycleNumber}`]);
      rows.push({
        id: `deposit-applied:${k.id}`,
        date: (da?.createdAt ?? k.createdAt).toISOString(),
        cycle: k.cycleNumber,
        member: name.get(k.memberId) ?? "",
        city: city.get(k.memberId) ?? "",
        type: "Deposit applied",
        direction: "Applied",
        amount: k.amountCents / 100,
        timing: "",
        status: "Pot kept whole",
        method: "",
        paypalId: "",
        ...auditFields(da, "apply_deposit"),
      });
    }
  }

  // Settlements: winner payout, dividends and the deposit held, with PayPal's confirmation where we have it.
  const memberIds = c.members.map((m) => m.id);
  for (const cy of c.cycles.filter((x) => x.state === "closed" && x.winnerId)) {
    const s = settle({
      contribution: body?.contributionCents ?? 0,
      memberIds,
      winnerId: cy.winnerId!,
      discount: cy.discountCents ?? 0,
      depositOn: depositRequired(cy.number, c.cycles.length, body?.depositOn ?? false),
    });
    const batch = batches.find((b) => b.purpose === "settlement" && b.cycleNumber === cy.number);
    const failures = new Map(((batch?.failures ?? []) as { memberId: string; reason: string }[]).map((f) => [f.memberId, f.reason]));
    const settleEntry = entries.find((e) => e.description === `Settlement of cycle ${cy.number}`);
    const paypalId = batch?.id ?? settleEntry?.paypalObjectId ?? "";
    const a = auditOf(paypalId, [`payout_batch||${cy.number}`]);
    const date = (settleEntry?.createdAt ?? cy.dueAt).toISOString();
    const status = (memberId: string) =>
      simulated ? "Paid (simulated)" : failures.has(memberId) ? `Failed: ${failures.get(memberId)}` : batch?.status === "success" ? "Confirmed by PayPal" : batch ? "Waiting for PayPal" : "Sent";
    const items = [{ memberId: s.winnerId, amount: s.winnerPayout, type: "Payout" }, ...s.dividends.map((d) => ({ ...d, type: "Dividend" }))];
    for (const it of items.filter((x) => x.amount > 0)) {
      rows.push({
        id: `payout:${cy.number}:${it.memberId}`,
        date,
        cycle: cy.number,
        member: name.get(it.memberId) ?? "",
        city: city.get(it.memberId) ?? "",
        type: it.type,
        direction: "Out",
        amount: it.amount / 100,
        timing: "",
        status: status(it.memberId),
        method: "PayPal Payouts",
        paypalId: simulated ? "" : paypalId,
        ...auditFields(a, "payout_batch"),
      });
    }
    if (s.deposit > 0) {
      rows.push({
        id: `deposit-held:${cy.number}`,
        date,
        cycle: cy.number,
        member: name.get(s.winnerId) ?? "",
        city: city.get(s.winnerId) ?? "",
        type: "Deposit held",
        direction: "Held",
        amount: s.deposit / 100,
        timing: "",
        status: "Held until the member finishes",
        method: "",
        paypalId: "",
        ...auditFields(a, "payout_batch"),
      });
    }
  }

  // Deposit refunds (one PayPal payout each).
  for (const e of entries.filter((x) => x.description.startsWith("Deposit refunded to "))) {
    const memberId = e.description.slice("Deposit refunded to ".length);
    const cash = (e.postings as unknown as Posting[]).filter((p) => p.account === accounts.cash).reduce((s, p) => s + p.credit - p.debit, 0);
    const batch = batches.find((b) => b.id === e.paypalObjectId);
    const a = auditOf(e.paypalObjectId, []);
    rows.push({
      id: `refund:${e.id}`,
      date: e.createdAt.toISOString(),
      cycle: c.cycles.length,
      member: name.get(memberId) ?? memberId,
      city: city.get(memberId) ?? "",
      type: "Deposit refund",
      direction: "Returned",
      amount: cash / 100,
      timing: "",
      status: batch?.status === "success" ? "Confirmed by PayPal" : batch?.status === "failed" ? "Failed" : "Waiting for PayPal",
      method: "PayPal Payouts",
      paypalId: e.paypalObjectId ?? "",
      ...auditFields(a, "refund_deposit"),
    });
  }
  return rows.sort((x, y) => x.date.localeCompare(y.date));
}

export async function auctionRows(db: PrismaClient, id: string) {
  const c = await db.circle.findUniqueOrThrow({ where: { id }, include: { members: true, cycles: { orderBy: { number: "asc" } } } });
  const name = new Map(c.members.map((m) => [m.id, m.displayName]));
  const bids = await db.bid.findMany({ where: { cycle: { circleId: id } }, include: { cycle: true }, orderBy: { placedAt: "asc" } });
  const rows: BidRow[] = bids.map((b) => {
    const sealed = b.cycle.state !== "closed";
    const won = b.cycle.state === "closed" && b.cycle.winnerId === b.memberId && b.accepted && b.discountCents === (b.cycle.discountCents ?? 0);
    return {
      id: b.id,
      cycle: `Cycle ${b.cycle.number}`,
      member: name.get(b.memberId) ?? "",
      source: b.source === "mcp" ? "Outside assistant (MCP)" : "Turn Agent",
      discount: sealed && b.accepted ? null : b.discountCents / 100,
      gate: b.accepted ? "passed" : "rejected",
      reason: b.gateReason ?? "",
      explanation: b.explanation ?? "",
      placedAt: b.placedAt.toISOString(),
      result: won ? "Winner" : sealed ? "Sealed" : "",
    };
  });
  // A winner can have two accepted rows only in odd cases; keep the first marked.
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.result !== "Winner") continue;
    if (seen.has(r.cycle)) r.result = "";
    seen.add(r.cycle);
  }
  const open = c.cycles.find((x) => x.state === "auction") ?? null;
  return {
    rows,
    openAuction: open ? { number: open.number } : null,
    live: c.mode === "live",
    cycles: c.cycles.filter((x) => x.state === "closed").map((x) => ({ number: x.number, winner: x.winnerId ? name.get(x.winnerId) ?? "" : "", discountCents: x.discountCents ?? 0 })),
  };
}

export async function circleList(db: PrismaClient) {
  const circles = await db.circle.findMany({
    where: { status: { not: "redteam" }, charters: { some: { frozen: true } } },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { _count: { select: { members: true } } },
  });
  return circles.map((c) => ({ id: c.id, name: c.name, mode: c.mode, status: c.status, members: c._count.members, createdAt: c.createdAt.toISOString() }));
}
