// Gate test 3: save a PayPal wallet (usage_type MERCHANT), then authorize with it — no buyer present.
import { createInterface } from "node:readline/promises";
import { paypalFetch } from "../src/paypal/client";
import { savePayPalPaymentSource } from "../src/paypal/vault";

const base = process.env.APP_BASE_URL ?? "https://turnwise-web.onrender.com";
const stamp = Date.now();
const rl = createInterface({ input: process.stdin, output: process.stdout });

// 1. Order that saves the wallet on success
const order = await paypalFetch<any>("/v2/checkout/orders", {
  method: "POST",
  requestId: `vault-save-${stamp}`,
  body: {
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "USD", value: "1.00" }, custom_id: "vault-save" }],
    payment_source: savePayPalPaymentSource(`${base}/?paypal=approved`, `${base}/?paypal=cancelled`),
  },
});
const link = order.links?.find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href;
console.log("Approve as a US sandbox buyer (private window):", link);
await rl.question("Press Enter after approving... ");

// 2. Capture; the response carries the vault ID (or the customer ID to look it up)
const captured = await paypalFetch<any>(`/v2/checkout/orders/${order.id}/capture`, { method: "POST", requestId: `vault-cap-${stamp}`, body: {} });
const vault = captured.payment_source?.paypal?.attributes?.vault;
console.log("vault:", JSON.stringify(vault));
let vaultId: string | undefined = vault?.id;
if (!vaultId && vault?.customer?.id) {
  const tokens = await paypalFetch<any>(`/v3/vault/payment-tokens?customer_id=${vault.customer.id}`);
  vaultId = tokens.payment_tokens?.[0]?.id;
}
if (!vaultId) {
  console.log("FAIL: no vault ID returned. Check 'Save payment methods' is enabled on this app.");
  process.exit(1);
}
console.log("GATE_VAULT_ID =", vaultId);

// 3. Merchant-initiated authorization with the saved wallet — no approval step
const mit = await paypalFetch<any>("/v2/checkout/orders", {
  method: "POST",
  requestId: `vault-auth-${stamp}`,
  body: {
    intent: "AUTHORIZE",
    purchase_units: [{ amount: { currency_code: "USD", value: "1.00" }, custom_id: "vault-mit" }],
    payment_source: { paypal: { vault_id: vaultId } },
  },
});
console.log("MIT order status:", mit.status);
let auth = mit.purchase_units?.[0]?.payments?.authorizations?.[0];
if (!auth && mit.status === "APPROVED") {
  const a = await paypalFetch<any>(`/v2/checkout/orders/${mit.id}/authorize`, { method: "POST", requestId: `vault-auth2-${stamp}`, body: {} });
  auth = a.purchase_units?.[0]?.payments?.authorizations?.[0];
}
console.log(auth ? `PASS: authorization ${auth.id} (${auth.status}) created without the buyer` : "FAIL: no authorization — use the one-tap fallback");
if (auth) await paypalFetch(`/v2/payments/authorizations/${auth.id}/void`, { method: "POST", requestId: `vault-void-${stamp}` });
rl.close();
