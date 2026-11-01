// PayPal Agent Toolkit tools exposed to the Treasurer. Only invoice and read-only tools are allowed;
// anything that moves money (refunds, pay_order) must go through execute() instead.
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";

const ALLOWED = new Set([
  "create_invoice",
  "send_invoice",
  "send_invoice_reminder",
  "generate_invoice_qr_code",
  "list_invoices",
  "get_invoice",
  "list_transactions",
  "list_disputes",
  "get_dispute",
]);

export function treasurerTools() {
  const toolkit = new PayPalAgentToolkit({
    clientId: process.env.PAYPAL_CLIENT_ID!,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
    // Check the action names against the toolkit README for the installed version.
    configuration: {
      actions: {
        invoices: { create: true, list: true, send: true, sendReminder: true, generateQRC: true },
        transactions: { list: true },
        disputes: { list: true, get: true },
      },
      context: { sandbox: true },
    },
  } as never);
  const all = toolkit.getTools() as Record<string, unknown>;
  return Object.fromEntries(Object.entries(all).filter(([name]) => ALLOWED.has(name)));
}
