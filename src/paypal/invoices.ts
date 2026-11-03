// Contribution invoices (Invoicing API v2): create a draft, then send it to the member.
import { paypalFetch } from "./client";

export async function createAndSendInvoice(args: {
  recipientEmail: string;
  value: string;
  reference: string;
  note: string;
  requestId: string;
}): Promise<{ id: string }> {
  const draft = await paypalFetch<{ id?: string; href?: string }>("/v2/invoicing/invoices", {
    method: "POST",
    requestId: args.requestId,
    body: {
      detail: {
        currency_code: "USD",
        reference: args.reference.slice(0, 120),
        note: args.note,
        payment_term: { term_type: "DUE_ON_RECEIPT" },
      },
      primary_recipients: [{ billing_info: { email_address: args.recipientEmail } }],
      items: [{ name: "Savings circle contribution", quantity: "1", unit_amount: { currency_code: "USD", value: args.value } }],
    },
  });
  const id = draft.id ?? draft.href?.split("/").pop();
  if (!id) throw new Error("PayPal did not return an invoice ID");
  await paypalFetch(`/v2/invoicing/invoices/${id}/send`, {
    method: "POST",
    requestId: `${args.requestId}-send`,
    body: { send_to_recipient: true, send_to_invoicer: false },
  });
  return { id };
}
