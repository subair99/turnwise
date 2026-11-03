// Read-only PayPal lookups used by reconciliation.
import { paypalFetch } from "./client";

export function getCapture(id: string) {
  return paypalFetch<{ id: string; status: string; amount?: { value: string; currency_code: string } }>(`/v2/payments/captures/${id}`);
}

export function getInvoice(id: string) {
  return paypalFetch<{ id: string; status: string; amount?: { value: string }; payments?: { paid_amount?: { value: string } } }>(`/v2/invoicing/invoices/${id}`);
}

export function getPayoutBatchDetail(id: string) {
  return paypalFetch<{
    batch_header?: { payout_batch_id: string; batch_status: string };
    items?: { transaction_status?: string; payout_item?: { amount?: { value: string } } }[];
  }>(`/v1/payments/payouts/${id}?page_size=1000`);
}
