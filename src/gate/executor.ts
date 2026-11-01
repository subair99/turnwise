// The ONLY module allowed to call PayPal (enforced by eslint.config.mjs).
// Flow: proposal -> evaluate() -> audit log -> PayPal call with idempotency key -> audit result.
import { evaluate, type GateContext, type Proposal } from "./policy";
import { toValue } from "../lib/money";
import { captureAuthorization, createAuthorizeOrder, voidAuthorization } from "../paypal/authorizations";
import { createPayoutBatch } from "../paypal/payouts";

export interface MemberDirectory {
  email(memberId: string): string;
  vaultId(memberId: string): string | undefined;
}

export interface AuditSink {
  record(row: { agent: string; proposal: Proposal; allowed: boolean; reasons: string[]; requestId: string; paypalId?: string }): Promise<void>;
}

export async function execute(
  agent: string,
  proposal: Proposal,
  ctx: GateContext,
  members: MemberDirectory,
  audit: AuditSink,
): Promise<{ allowed: boolean; reasons: string[]; paypalId?: string }> {
  const decision = evaluate(proposal, ctx);
  if (!decision.allowed) {
    await audit.record({ agent, proposal, allowed: false, reasons: decision.reasons, requestId: decision.requestId });
    return { allowed: false, reasons: decision.reasons };
  }

  let paypalId: string | undefined;
  switch (proposal.kind) {
    case "payout_batch": {
      const batch = await createPayoutBatch({
        senderBatchId: decision.requestId,
        emailSubject: "Your Turnwise circle payout",
        items: proposal.items.map((i, n) => ({
          receiver: members.email(i.memberId),
          value: toValue(i.amount),
          note: `Cycle ${proposal.cycle}`,
          senderItemId: `${decision.requestId}-${n}`,
        })),
        requestId: decision.requestId,
      });
      paypalId = batch.batch_header?.payout_batch_id;
      break;
    }
    case "create_preauth": {
      const order = await createAuthorizeOrder({
        value: toValue(proposal.amount),
        customId: `${proposal.charterHash.slice(0, 20)}|c${proposal.cycle}|${proposal.memberId}`.slice(0, 127),
        vaultId: members.vaultId(proposal.memberId),
        requestId: decision.requestId,
      });
      paypalId = order.id;
      break;
    }
    case "capture_preauth": {
      const cap = await captureAuthorization(proposal.authorizationId, toValue(proposal.amount), decision.requestId);
      paypalId = cap.id;
      break;
    }
    case "void_preauth":
      await voidAuthorization(proposal.authorizationId, decision.requestId);
      paypalId = proposal.authorizationId;
      break;
    case "refund_deposit": {
      const batch = await createPayoutBatch({
        senderBatchId: decision.requestId,
        emailSubject: "Your Turnwise deposit is returned",
        items: [{ receiver: members.email(proposal.memberId), value: toValue(proposal.amount), note: "Deposit refund", senderItemId: decision.requestId }],
        requestId: decision.requestId,
      });
      paypalId = batch.batch_header?.payout_batch_id;
      break;
    }
    case "accept_bid":
    case "apply_deposit":
      // Ledger-only actions: no PayPal call needed.
      break;
  }

  await audit.record({ agent, proposal, allowed: true, reasons: [], requestId: decision.requestId, paypalId });
  return { allowed: true, reasons: [], paypalId };
}
