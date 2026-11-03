// Pre-authorized contributions. PayPal authorizations last 29 days (3-day honor period);
// after 30 days a new authorization is required, so Turnwise creates one per contribution,
// 5 days before it is due, and never relies on reauthorization.
import { paypalFetch } from "./client";

export interface Order {
  id: string;
  status: string;
  links?: { href: string; rel: string }[];
  purchase_units?: { payments?: { authorizations?: { id: string; status: string; expiration_time?: string }[] } }[];
}

export async function createAuthorizeOrder(args: { value: string; customId: string; vaultId?: string; requestId: string }): Promise<Order> {
  const base = process.env.APP_BASE_URL ?? "https://turnwise-web.onrender.com";
  return paypalFetch<Order>("/v2/checkout/orders", {
    method: "POST",
    requestId: args.requestId,
    body: {
      intent: "AUTHORIZE",
      purchase_units: [{ amount: { currency_code: "USD", value: args.value }, custom_id: args.customId }],
      payment_source: args.vaultId
        ? { paypal: { vault_id: args.vaultId } }
        : {
            paypal: {
              experience_context: {
                return_url: `${base}/?paypal=approved`,
                cancel_url: `${base}/?paypal=cancelled`,
                user_action: "CONTINUE",
                shipping_preference: "NO_SHIPPING",
              },
            },
          },
    },
  });
}

// Needed after buyer approval (one-tap fallback). Verify on 2 Nov whether vaulted orders also need it.
export async function authorizeOrder(orderId: string, requestId: string): Promise<Order> {
  return paypalFetch<Order>(`/v2/checkout/orders/${orderId}/authorize`, { method: "POST", requestId, body: {} });
}

export async function captureAuthorization(authorizationId: string, value: string, requestId: string) {
  return paypalFetch<{ id: string; status: string }>(`/v2/payments/authorizations/${authorizationId}/capture`, {
    method: "POST",
    requestId,
    body: { amount: { currency_code: "USD", value }, final_capture: true },
  });
}

export async function voidAuthorization(authorizationId: string, requestId: string): Promise<void> {
  await paypalFetch(`/v2/payments/authorizations/${authorizationId}/void`, { method: "POST", requestId });
}

export function approveLink(order: Order): string | undefined {
  return order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
}

export function firstAuthorization(order: Order) {
  return order.purchase_units?.[0]?.payments?.authorizations?.[0];
}
