// The Guardian's scheduled work for one collecting cycle. Every step is idempotent and safe to re-run.
import type { Cycle, PrismaClient } from "@prisma/client";
import { ladderActions, ladderStep, type LadderStep } from "@/domain/default-ladder";
import { applyDeposit } from "@/domain/deposits";
import { depositAppliedEntry } from "@/domain/ledger";
import { preauthDueAt } from "@/domain/clock";
import type { CharterBody } from "@/domain/charter";
import { explain } from "@/agents/guardian";
import { gateFor } from "./gate-context";
import { postEntry } from "./ledger-store";
import { captureDue, preauthorize } from "./preauth";
import { notice } from "./notices";

type Log = (m: string) => void;

// A failure on PayPal's side (or ours: bad credentials, network) is not a member missing a payment.
export const platformErrors = new Set<string>();
export function isPlatformError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  const status = (err as { status?: number })?.status;
  return /OAuth failed|invalid_client|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(msg) || (typeof status === "number" && status >= 500);
}
const RESOLVED = new Set(["paid", "covered"]);

// 5 days (charter) before the due date: authorize each contribution from the member's saved wallet.
export async function runPreauthWindow(db: PrismaClient, circleId: string, cycle: Cycle, body: CharterBody, at: Date, log: Log) {
  if (at < preauthDueAt(cycle.dueAt, body.preauthLeadDays)) return;
  const members = await db.member.findMany({ where: { circleId } });
  const contribs = await db.contribution.findMany({ where: { circleId, cycleNumber: cycle.number } });
  for (const m of members) {
    const c = contribs.find((x) => x.memberId === m.id);
    if (!c || c.status !== "due") continue;
    if (!m.vaultId) continue; // pays by invoice instead
    if (m.simulateMissCycle === cycle.number) {
      await db.contribution.update({ where: { id: c.id }, data: { status: "pending" } });
      await notice(db, { circleId, memberId: m.id, cycleNumber: cycle.number, kind: "info", text: `${m.displayName}: payment not authorized (simulated miss for the demo).` });
      log(`${m.displayName}: simulated miss — no authorization`);
      continue;
    }
    try {
      const pre = await preauthorize(db, circleId, m.id, cycle.number);
      log(`${m.displayName}: authorized ${pre.authorizationId ?? "(needs one-tap approval)"}`);
    } catch (err) {
      if (isPlatformError(err)) platformErrors.add(circleId);
      log(`${m.displayName}: pre-authorization failed: ${(err as Error).message}`);
    }
  }
}

// On the due date: capture every authorized contribution.
export async function runCaptures(db: PrismaClient, circleId: string, cycle: Cycle, at: Date, log: Log) {
  if (at < cycle.dueAt) return;
  const members = await db.member.findMany({ where: { circleId } });
  const pres = await db.preAuthorization.findMany({ where: { cycleNumber: cycle.number, status: "authorized", memberId: { in: members.map((m) => m.id) } } });
  for (const p of pres) {
    const name = members.find((m) => m.id === p.memberId)?.displayName ?? p.memberId;
    try {
      const paid = await captureDue(db, circleId, p.memberId, cycle.number);
      log(`${name}: captured ${paid.captureId}`);
    } catch (err) {
      if (isPlatformError(err)) platformErrors.add(circleId);
      log(`${name}: capture failed: ${(err as Error).message}`);
    }
  }
}

// After the due date: reminder -> grace -> cure window -> deposit applied -> member vote if more is owed.
export async function runDefaultSteps(db: PrismaClient, circleId: string, cycle: Cycle, body: CharterBody, at: Date, log: Log) {
  if (at < cycle.dueAt) return;
  const policy = body.defaultSteps;
  const unpaid = await db.contribution.findMany({
    where: { circleId, cycleNumber: cycle.number, status: { notIn: [...RESOLVED, "shortfall"] } },
    include: { member: true },
  });

  for (const c of unpaid) {
    const prev = c.ladderStep as LadderStep;
    const next = ladderStep(cycle.dueAt, at, false, policy);
    if (next === prev) continue;
    await db.contribution.update({ where: { id: c.id }, data: { ladderStep: next } });
    const name = c.member.displayName;

    for (const action of ladderActions(prev, next)) {
      if (action === "send_reminder" || action === "open_cure_window") {
        const text = await explain(action, { member: name, cycle: cycle.number, graceDays: policy.graceDays, cureHours: policy.cureHours });
        await notice(db, { circleId, memberId: c.memberId, cycleNumber: cycle.number, kind: action === "send_reminder" ? "reminder" : "cure_window", text });
        log(`${name}: ${action}`);
        continue;
      }

      // apply_deposit
      const member = await db.member.findUniqueOrThrow({ where: { id: c.memberId } });
      const { applied, shortfall } = applyDeposit(member.depositCents, c.amountCents);
      if (applied > 0) {
        const g = await gateFor(db, circleId, cycle.number, "guardian");
        const res = await g.run({ kind: "apply_deposit", circleId, cycle: cycle.number, charterHash: g.charterHash, memberId: c.memberId, amount: applied });
        if (!res.allowed) {
          log(`${name}: deposit refused by gate: ${res.reasons.join("; ")}`);
          continue;
        }
        await postEntry(db, circleId, { ...depositAppliedEntry(c.memberId, cycle.number, applied), requestId: `deposit:${circleId}:${cycle.number}:${c.memberId}` });
        await db.member.update({ where: { id: c.memberId }, data: { depositCents: { decrement: applied } } });
      }
      const status = shortfall === 0 ? "covered" : "shortfall";
      await db.contribution.update({ where: { id: c.id }, data: { status, ladderStep: "resolved" } });
      const text = await explain(shortfall === 0 ? "apply_deposit" : "vote", { member: name, cycle: cycle.number, depositUsedCents: applied, stillOwedCents: shortfall });
      await notice(db, { circleId, memberId: c.memberId, cycleNumber: cycle.number, kind: shortfall === 0 ? "deposit_applied" : "vote", text });
      log(`${name}: deposit applied ${applied} cents${shortfall ? `, ${shortfall} still owed -> member vote` : ""}`);
    }
  }
}
