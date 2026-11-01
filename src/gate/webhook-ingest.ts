// Webhook ingestion lives in src/gate because it calls PayPal (signature verification).
import type { PrismaClient } from "@prisma/client";
import { verifySignature } from "../paypal/webhooks";

export async function ingestWebhook(headers: Headers, event: { id: string; event_type: string }, db: PrismaClient) {
  const verified = await verifySignature(headers, event);
  if (!verified) return { ok: false, reason: "signature verification failed" };
  try {
    await db.webhookEvent.create({ data: { id: event.id, eventType: event.event_type, verified, payload: event as object } });
  } catch {
    return { ok: true, duplicate: true }; // primary key on PayPal's event ID gives de-duplication
  }
  // TODO: map event_type to ledger entries and PreAuthorization / Cycle state changes
  return { ok: true };
}
