// Member pay-ins (intent CAPTURE). The first pay-in saves the member's PayPal wallet
// (usage_type MERCHANT) so later contributions can be pre-authorized without them present.
import { paypalFetch } from "./client";
import type { Order } from "./authorizations";
import { savePayPalPaymentSource } from "./vault";

export interface CapturedOrder {
  id: string;
  status: string;
  payment_source?: unknown;
  purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[];
}

export async function createPayinOrder(args: {
  value: string;
  customId: string;
  saveWallet: boolean;
  returnUrl: string;
  cancelUrl: string;
  requestId: string;
}): Promise<Order> {
  const payment_source = args.saveWallet
    ? savePayPalPaymentSource(args.returnUrl, args.cancelUrl)
    : {
        paypal: {
          experience_context: {
            return_url: args.returnUrl,
            cancel_url: args.cancelUrl,
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        },
      };
  return paypalFetch<Order>("/v2/checkout/orders", {
    method: "POST",
    requestId: args.requestId,
    body: {
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: args.value }, custom_id: args.customId }],
      payment_source,
    },
  });
}

export async function captureOrder(orderId: string, requestId: string): Promise<CapturedOrder> {
  return paypalFetch<CapturedOrder>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", requestId, body: {} });
}
