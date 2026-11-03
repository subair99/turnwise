// Deterministic policy gate. No model calls in this file — ever.
import type { Cents } from "../lib/money";
import type { LadderStep } from "../domain/default-ladder";
import { requestId } from "./idempotency";

interface Base {
  circleId: string;
  cycle: number;
  charterHash: string;
}

export type Proposal =
  | (Base & { kind: "create_payin"; memberId: string; amount: Cents; returnUrl: string; cancelUrl: string })
  | (Base & { kind: "capture_payin"; memberId: string; orderId: string })
  | (Base & { kind: "send_invoice"; memberId: string; amount: Cents })
  | (Base & { kind: "accept_bid"; memberId: string; mandateHash: string; discount: Cents })
  | (Base & { kind: "payout_batch"; items: { memberId: string; amount: Cents }[] })
  | (Base & { kind: "create_preauth"; memberId: string; amount: Cents })
  | (Base & { kind: "capture_preauth"; memberId: string; authorizationId: string; amount: Cents })
  | (Base & { kind: "void_preauth"; memberId: string; authorizationId: string })
  | (Base & { kind: "apply_deposit"; memberId: string; amount: Cents })
  | (Base & { kind: "refund_deposit"; memberId: string; amount: Cents })
  | (Base & { kind: "repay_owed"; memberId: string; amount: Cents; attempt: number });

export interface GateContext {
  charter: { hash: string; frozen: boolean; contribution: Cents; memberIds: string[]; depositOn: boolean };
  cycle: { number: number; state: "pending" | "collecting" | "auction" | "settling" | "closed"; potCollected: Cents };
  mandates: Record<string, { hash: string; maxDiscount: Cents; revoked: boolean }>;
  ladder: Record<string, LadderStep>;
  deposits: Record<string, Cents>;
  executedRequestIds: Set<string>;
  paidThisCycle?: Set<string>;
  collected?: Set<string>;
  owed?: Record<string, Cents>; // payouts PayPal could not complete, held for the member
}

export interface GateDecision {
  allowed: boolean;
  reasons: string[];
  requestId: string;
}

function subjectOf(p: Proposal): string {
  switch (p.kind) {
    case "payout_batch":
      return p.items.map((i) => `${i.memberId}:${i.amount}`).sort().join(",");
    case "capture_preauth":
    case "void_preauth":
      return `${p.memberId}:${p.authorizationId}`;
    case "capture_payin":
      return `${p.memberId}:${p.orderId}`;
    case "repay_owed":
      return `${p.memberId}:retry-${p.attempt}`;
    default:
      return p.memberId;
  }
}

export function evaluate(p: Proposal, ctx: GateContext): GateDecision {
  const reasons: string[] = [];
  const rid = requestId(p.circleId, p.cycle, p.kind, subjectOf(p));
  const isMember = (id: string) => ctx.charter.memberIds.includes(id);
  const alreadyPaid = (id: string) => ctx.paidThisCycle?.has(id) ?? false;

  if (!ctx.charter.frozen) reasons.push("charter not approved and frozen");
  if (p.charterHash !== ctx.charter.hash) reasons.push("charter hash mismatch");
  if (p.cycle !== ctx.cycle.number) reasons.push("wrong cycle");
  if (ctx.executedRequestIds.has(rid)) reasons.push("already executed (idempotency)");

  switch (p.kind) {
    case "create_payin":
    case "send_invoice":
      if (ctx.cycle.state !== "collecting") reasons.push("cycle not collecting");
      if (!isMember(p.memberId)) reasons.push("not a member");
      if (p.amount !== ctx.charter.contribution) reasons.push("amount must equal one contribution");
      if (alreadyPaid(p.memberId)) reasons.push("already paid this cycle");
      break;
    case "capture_payin":
      if (!isMember(p.memberId)) reasons.push("not a member");
      if (alreadyPaid(p.memberId)) reasons.push("already paid this cycle");
      break;
    case "accept_bid": {
      const m = ctx.mandates[p.memberId];
      if (ctx.cycle.state !== "auction") reasons.push("auction not open");
      if (ctx.collected?.has(p.memberId)) reasons.push("member has already collected");
      if (!isMember(p.memberId)) reasons.push("not a member");
      if (!m) reasons.push("no mandate");
      else {
        if (m.revoked) reasons.push("mandate revoked");
        if (m.hash !== p.mandateHash) reasons.push("mandate hash mismatch");
        if (p.discount > m.maxDiscount) reasons.push("over mandate cap");
      }
      break;
    }
    case "payout_batch": {
      if (ctx.cycle.state !== "settling") reasons.push("cycle not settling");
      const total = p.items.reduce((s, i) => s + i.amount, 0);
      if (total > ctx.cycle.potCollected) reasons.push("payout exceeds collected pot");
      if (p.items.some((i) => !isMember(i.memberId))) reasons.push("payout to non-member");
      if (p.items.some((i) => !Number.isInteger(i.amount) || i.amount <= 0)) reasons.push("invalid payout amount");
      break;
    }
    case "create_preauth":
      if (!isMember(p.memberId)) reasons.push("not a member");
      if (p.amount !== ctx.charter.contribution) reasons.push("pre-authorization must equal one contribution");
      if (alreadyPaid(p.memberId)) reasons.push("already paid this cycle");
      break;
    case "capture_preauth":
      if (!isMember(p.memberId)) reasons.push("not a member");
      if (p.amount > ctx.charter.contribution) reasons.push("capture exceeds one contribution");
      break;
    case "void_preauth":
      if (!isMember(p.memberId)) reasons.push("not a member");
      break;
    case "apply_deposit":
      if (ctx.ladder[p.memberId] !== "deposit_due") reasons.push("default steps not complete");
      if (p.amount > (ctx.deposits[p.memberId] ?? 0)) reasons.push("amount exceeds deposit held");
      break;
    case "refund_deposit":
      if (p.amount > (ctx.deposits[p.memberId] ?? 0)) reasons.push("amount exceeds deposit held");
      break;
    case "repay_owed":
      if (!isMember(p.memberId)) reasons.push("not a member");
      if (!Number.isInteger(p.amount) || p.amount <= 0) reasons.push("invalid amount");
      if (p.amount > (ctx.owed?.[p.memberId] ?? 0)) reasons.push("more than is owed to the member");
      break;
  }

  return { allowed: reasons.length === 0, reasons, requestId: rid };
}
