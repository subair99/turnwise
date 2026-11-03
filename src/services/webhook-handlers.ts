// Verified PayPal events -> contribution / pre-authorization state + ledger.
// Every handler is idempotent: the ledger request ID matches the one used on the API path.
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordPaid } from "./contributions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resource = Record<string, any>;

function kindOf(type: string): string {
  if (type.startsWith("INVOICING")) return "invoice";
  if (type.includes("PAYOUTS")) return "payout";
  if (type.includes("AUTHORIZATION")) return "authorization";
  if (type.includes("CAPTURE")) return "capture";
  if (type.startsWith("CUSTOMER.DISPUTE")) return "dispute";
  if (type.startsWith("VAULT")) return "vault_token";
  if (type.startsWith("CHECKOUT")) return "order";
  return "other";
}

export async function handleEvent(db: PrismaClient, event: { id: string; event_type: string; resource?: Resource }): Promise<string> {
  const r: Resource = event.resource ?? {};
  const objectId: string | undefined = r.invoice?.id ?? r.payout_item_id ?? r.batch_header?.payout_batch_id ?? r.dispute_id ?? r.id;
  if (objectId) {
    const status = String(r.status ?? r.transaction_status ?? r.invoice?.status ?? r.batch_header?.batch_status ?? event.event_type);
    const raw = r as unknown as Prisma.InputJsonValue;
    await db.paypalObject.upsert({
      where: { id: objectId },
      create: { id: objectId, kind: kindOf(event.event_type), status, raw },
      update: { status, raw },
    });
  }

  switch (event.event_type) {
    case "INVOICING.INVOICE.PAID": {
      const invoiceId: string | undefined = r.invoice?.id ?? r.id;
      const c = invoiceId ? await db.contribution.findUnique({ where: { invoiceId } }) : null;
      if (!c) return "invoice paid: no matching contribution";
      await recordPaid(db, c.id, { paypalId: invoiceId });
      return "contribution paid (invoice)";
    }
    case "PAYMENT.CAPTURE.COMPLETED": {
      const rel: Resource = r.supplementary_data?.related_ids ?? {};
      let c = rel.order_id ? await db.contribution.findUnique({ where: { orderId: rel.order_id } }) : null;
      if (!c && rel.authorization_id) {
        const pre = await db.preAuthorization.findUnique({ where: { authorizationId: rel.authorization_id } });
        if (pre) {
          await db.preAuthorization.update({ where: { id: pre.id }, data: { status: "captured" } });
          c = await db.contribution.findUnique({ where: { memberId_cycleNumber: { memberId: pre.memberId, cycleNumber: pre.cycleNumber } } });
        }
      }
      if (!c) return "capture: no matching contribution";
      await recordPaid(db, c.id, { captureId: r.id });
      return "contribution paid (capture)";
    }
    case "PAYMENT.CAPTURE.DENIED": {
      const authId: string | undefined = r.supplementary_data?.related_ids?.authorization_id;
      const pre = authId ? await db.preAuthorization.findUnique({ where: { authorizationId: authId } }) : null;
      if (!pre) return "capture denied: no matching pre-authorization";
      await db.preAuthorization.update({ where: { id: pre.id }, data: { status: "failed" } });
      await db.contribution.updateMany({ where: { memberId: pre.memberId, cycleNumber: pre.cycleNumber, status: { not: "paid" } }, data: { status: "failed" } });
      return "capture denied: default steps will start";
    }
    case "PAYMENT.AUTHORIZATION.CREATED":
    case "PAYMENT.AUTHORIZATION.VOIDED": {
      const pre = r.id ? await db.preAuthorization.findUnique({ where: { authorizationId: r.id } }) : null;
      if (!pre) return "authorization: not tracked";
      const status = event.event_type.endsWith("VOIDED") ? "voided" : pre.status === "captured" ? "captured" : "authorized";
      await db.preAuthorization.update({ where: { id: pre.id }, data: { status } });
      return `authorization ${status}`;
    }
    case "VAULT.PAYMENT-TOKEN.CREATED": {
      const orderId: string | undefined = r.metadata?.order_id;
      const c = orderId ? await db.contribution.findUnique({ where: { orderId } }) : null;
      if (!c || !r.id) return "vault token: no matching contribution";
      await db.member.update({ where: { id: c.memberId }, data: { vaultId: r.id } });
      return "vault token saved";
    }
    default:
      return "recorded";
  }
}
