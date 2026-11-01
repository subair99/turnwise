// Save the member's PayPal wallet during their first pay-in so the Guardian can create
// authorizations later without them present. Must be enabled in the Developer Dashboard (sandbox).
// Production needs PayPal approval for reference transactions and is limited to listed countries.
export function savePayPalPaymentSource(returnUrl: string, cancelUrl: string) {
  return {
    paypal: {
      attributes: { vault: { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" } },
      experience_context: { return_url: returnUrl, cancel_url: cancelUrl, shipping_preference: "NO_SHIPPING" },
    },
  };
}

// Reads the vault ID from a captured or authorized order response.
export function vaultIdFrom(order: unknown): string | undefined {
  const o = order as { payment_source?: { paypal?: { attributes?: { vault?: { id?: string } } } } };
  return o.payment_source?.paypal?.attributes?.vault?.id;
}
