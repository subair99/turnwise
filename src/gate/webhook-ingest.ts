// Webhook ingestion lives in src/gate because it calls PayPal (signature verification).
import type { Prisma, PrismaClient } from "@prisma/client";
import { verifySignature } from "../paypal/webhooks";
import { handleEvent } from "../services/webhook-handlers";

export async function ingestWebhook(
  headers: Headers,
  event: { id: string; event_type: string; resource?: Record<string, unknown> },
  db: PrismaClient,
) {
  const verified = await verifySignature(headers, event);
  if (!verified) return { ok: false, reason: "signature verification failed" };

  try {
    await db.webhookEvent.create({
      data: { id: event.id, eventType: event.event_type, verified, payload: event as unknown as Prisma.InputJsonValue },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: true, duplicate: true };
    throw e;
  }

  try {
    const outcome = await handleEvent(db, event);
    await db.webhookEvent.update({ where: { id: event.id }, data: { processed: true } });
    return { ok: true, outcome };
  } catch (err) {
    // Let PayPal retry: remove the stored event so the retry is processed, not treated as a duplicate.
    await db.webhookEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    throw err;
  }
}
