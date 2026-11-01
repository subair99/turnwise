import { paypalFetch } from "./client";

export interface PayoutItem {
  receiver: string; // sandbox email; use recipientWallet "Venmo" only for US members
  value: string;
  note: string;
  senderItemId: string;
  recipientWallet?: "PayPal" | "Venmo";
}

export async function createPayoutBatch(args: { senderBatchId: string; emailSubject: string; items: PayoutItem[]; requestId: string }) {
  return paypalFetch<{ batch_header?: { payout_batch_id: string; batch_status: string } }>("/v1/payments/payouts", {
    method: "POST",
    requestId: args.requestId,
    body: {
      sender_batch_header: { sender_batch_id: args.senderBatchId, email_subject: args.emailSubject, recipient_type: "EMAIL" },
      items: args.items.map((i) => ({
        amount: { value: i.value, currency: "USD" },
        receiver: i.receiver,
        note: i.note,
        sender_item_id: i.senderItemId,
        ...(i.recipientWallet ? { recipient_wallet: i.recipientWallet } : {}),
      })),
    },
  });
}

export async function getPayoutBatch(batchId: string) {
  return paypalFetch(`/v1/payments/payouts/${batchId}`);
}
