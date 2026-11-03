// The ONLY module allowed to call PayPal (enforced by eslint.config.mjs).
// Flow: proposal -> evaluate() -> PayPal call with idempotency key -> audit log.
import { evaluate, type GateContext, type Proposal } from "./policy";
import { toValue } from "../lib/money";
import {
  approveLink,
  authorizeOrder,
  captureAuthorization,
  createAuthorizeOrder,
  firstAuthorization,
  voidAuthorization,
} from "../paypal/authorizations";
import { createPayoutBatch } from "../paypal/payouts";
import { captureOrder, createPayinOrder } from "../paypal/orders";
import { createAndSendInvoice } from "../paypal/invoices";
import { vaultIdFrom } from "../paypal/vault";

export interface MemberDirectory {
  email(memberId: string): string;
  vaultId(memberId: string): string | undefined;
}

export interface AuditRow {
  agent: string;
  proposal: Proposal;
  allowed: boolean;
  reasons: string[];
  requestId: string;
  paypalId?: string;
}

export interface AuditSink {
  record(row: AuditRow): Promise<void>;
}

export interface Extracted {
  orderId?: string;
  authorizationId?: string;
  captureId?: string;
  vaultId?: string;
  approveUrl?: string;
  invoiceId?: string;
  payoutBatchId?: string;
  status?: string;
  expiresAt?: string;
}

export interface ExecResult {
  allowed: boolean;
  reasons: string[];
  requestId: string;
  paypalId?: string;
  extracted: Extracted;
}

function customId(p: Proposal & { memberId: string }): string {
  return `${p.charterHash.slice(7, 27)}|c${p.cycle}|${p.memberId}`.slice(0, 127);
}

async function call(p: Proposal, rid: string, members: MemberDirectory): Promise<Extracted> {
  switch (p.kind) {
    case "create_payin": {
      const order = await createPayinOrder({
        value: toValue(p.amount),
        customId: customId(p),
        saveWallet: !members.vaultId(p.memberId),
        returnUrl: p.returnUrl,
        cancelUrl: p.cancelUrl,
        requestId: rid,
      });
      return { orderId: order.id, approveUrl: approveLink(order), status: order.status };
    }
    case "capture_payin": {
      const c = await captureOrder(p.orderId, rid);
      const cap = c.purchase_units?.[0]?.payments?.captures?.[0];
      return { orderId: p.orderId, captureId: cap?.id, status: cap?.status ?? c.status, vaultId: vaultIdFrom(c) };
    }
    case "send_invoice": {
      const inv = await createAndSendInvoice({
        recipientEmail: members.email(p.memberId),
        value: toValue(p.amount),
        reference: `${p.charterHash.slice(7, 23)} cycle ${p.cycle}`,
        note: `Turnwise savings circle contribution, cycle ${p.cycle}`,
        requestId: rid,
      });
      return { invoiceId: inv.id, status: "SENT" };
    }
    case "create_preauth": {
      const vaultId = members.vaultId(p.memberId);
      const order = await createAuthorizeOrder({ value: toValue(p.amount), customId: customId(p), vaultId, requestId: rid });
      let auth = firstAuthorization(order);
      if (!auth && vaultId && order.status === "APPROVED") {
        auth = firstAuthorization(await authorizeOrder(order.id, `${rid}-auth`));
      }
      return {
        orderId: order.id,
        authorizationId: auth?.id,
        status: auth?.status ?? order.status,
        expiresAt: auth?.expiration_time,
        approveUrl: auth ? undefined : approveLink(order), // one-tap fallback when no wallet is saved
      };
    }
    case "capture_preauth": {
      const cap = await captureAuthorization(p.authorizationId, toValue(p.amount), rid);
      return { authorizationId: p.authorizationId, captureId: cap.id, status: cap.status };
    }
    case "void_preauth":
      await voidAuthorization(p.authorizationId, rid);
      return { authorizationId: p.authorizationId, status: "VOIDED" };
    case "payout_batch": {
      const batch = await createPayoutBatch({
        senderBatchId: rid,
        emailSubject: "Your Turnwise circle payout",
        items: p.items.map((i, n) => ({
          receiver: members.email(i.memberId),
          value: toValue(i.amount),
          note: `Cycle ${p.cycle}`,
          senderItemId: `${rid}-${n}`,
        })),
        requestId: rid,
      });
      return { payoutBatchId: batch.batch_header?.payout_batch_id, status: batch.batch_header?.batch_status };
    }
    case "refund_deposit": {
      const batch = await createPayoutBatch({
        senderBatchId: rid,
        emailSubject: "Your Turnwise deposit is returned",
        items: [{ receiver: members.email(p.memberId), value: toValue(p.amount), note: "Deposit refund", senderItemId: rid }],
        requestId: rid,
      });
      return { payoutBatchId: batch.batch_header?.payout_batch_id, status: batch.batch_header?.batch_status };
    }
    case "accept_bid":
    case "apply_deposit":
      return {}; // ledger-only actions
    default: {
      const unreachable: never = p;
      return unreachable;
    }
  }
}

export async function execute(
  agent: string,
  proposal: Proposal,
  ctx: GateContext,
  members: MemberDirectory,
  audit: AuditSink,
): Promise<ExecResult> {
  const decision = evaluate(proposal, ctx);
  if (!decision.allowed) {
    await audit.record({ agent, proposal, allowed: false, reasons: decision.reasons, requestId: decision.requestId });
    return { allowed: false, reasons: decision.reasons, requestId: decision.requestId, extracted: {} };
  }

  let extracted: Extracted;
  try {
    extracted = await call(proposal, decision.requestId, members);
  } catch (err) {
    // Logged as not executed, so a retry with the same request ID is allowed (PayPal de-duplicates it).
    await audit.record({
      agent,
      proposal,
      allowed: false,
      reasons: [`paypal_error: ${(err as Error).message}`],
      requestId: decision.requestId,
    });
    throw err;
  }

  const paypalId =
    extracted.captureId ?? extracted.authorizationId ?? extracted.payoutBatchId ?? extracted.invoiceId ?? extracted.orderId;
  await audit.record({ agent, proposal, allowed: true, reasons: [], requestId: decision.requestId, paypalId });
  ctx.executedRequestIds.add(decision.requestId);
  return { allowed: true, reasons: [], requestId: decision.requestId, paypalId, extracted };
}
