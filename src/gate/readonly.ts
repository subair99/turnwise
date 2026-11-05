// Read-only PayPal access for reconciliation. Lives in src/gate so the "only the gate talks to PayPal" rule holds.
// Nothing here can move money.
import { toCents } from "../lib/money";
import { getCapture, getInvoice, getPayoutBatchDetail } from "../paypal/reads";

const NOT_PAID_OUT = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED", "CANCELED"]);

export type PayPalKind = "capture" | "invoice" | "payout_batch";

// Signed cash movement PayPal reports for this object, in cents (money in > 0, money out < 0).
export async function paypalCashMovement(kind: PayPalKind, id: string): Promise<{ cents: number; status: string }> {
  switch (kind) {
    case "capture": {
      const c = await getCapture(id);
      const ok = c.status === "COMPLETED" || c.status === "PENDING";
      return { cents: ok ? toCents(c.amount?.value ?? "0") : 0, status: c.status };
    }
    case "invoice": {
      const i = await getInvoice(id);
      const paid = i.status === "PAID" || i.status === "MARKED_AS_PAID";
      return { cents: paid ? toCents(i.payments?.paid_amount?.value ?? i.amount?.value ?? "0") : 0, status: i.status };
    }
    case "payout_batch": {
      const b = await getPayoutBatchDetail(id);
      const out = (b.items ?? [])
        .filter((it) => !NOT_PAID_OUT.has(it.transaction_status ?? ""))
        .reduce((s, it) => s + toCents(it.payout_item?.amount?.value ?? "0"), 0);
      return { cents: -out, status: b.batch_header?.batch_status ?? "UNKNOWN" };
    }
  }
}

export interface PayoutItemOutcome {
  index: number; // position in the batch as sent
  status: string;
  amountCents: number;
  error?: string;
}

// Final (or current) state of a payout batch and each of its items.
export async function payoutBatchOutcome(id: string): Promise<{ batchStatus: string; items: PayoutItemOutcome[] }> {
  const b = await getPayoutBatchDetail(id);
  const senderBatchId = (b.batch_header as unknown as { sender_batch_header?: { sender_batch_id?: string } } | undefined)?.sender_batch_header?.sender_batch_id;
  const items = (b.items ?? []).map((it) => {
    const x = it as unknown as { transaction_status?: string; payout_item?: { amount?: { value: string }; sender_item_id?: string }; errors?: { name?: string; message?: string } };
    const sid = x.payout_item?.sender_item_id ?? "";
    const m = sid.match(/-(\d{1,3})$/);
    return {
      index: sid === senderBatchId ? 0 : m ? Number(m[1]) : 0,
      status: x.transaction_status ?? "UNKNOWN",
      amountCents: toCents(x.payout_item?.amount?.value ?? "0"),
      error: x.errors?.name ? `${x.errors.name}: ${x.errors.message ?? ""}`.trim() : undefined,
    };
  });
  return { batchStatus: b.batch_header?.batch_status ?? "UNKNOWN", items };
}

// Webhook diagnostics (read-only): which webhooks this app has, and which events PayPal generated for it.
export async function webhookDiagnostics(sinceDays = 3) {
  const { paypalFetch } = await import("../paypal/client");
  const hooks = await paypalFetch<{ webhooks?: { id: string; url: string; event_types?: { name: string }[] }[] }>("/v1/notifications/webhooks");
  const start = new Date(Date.now() - sinceDays * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const events = await paypalFetch<{ events?: { id: string; event_type: string; create_time: string }[] }>(
    `/v1/notifications/webhooks-events?page_size=20&start_time=${encodeURIComponent(start)}`,
  );
  return {
    webhooks: (hooks.webhooks ?? []).map((w) => ({ id: w.id, url: w.url, events: (w.event_types ?? []).map((e) => e.name) })),
    events: events.events ?? [],
  };
}
