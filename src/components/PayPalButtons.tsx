"use client";
// PayPal JavaScript SDK v6 pay-in and approval buttons.
// TODO: follow the v6 integration guide in the PayPal developer docs:
//   1. server route returns a browser-safe client token
//   2. load the v6 core script for sandbox
//   3. create an instance with the PayPal payments component and start the payment session
// Orders are always created server-side through the gate.
export function PayPalButtons({ orderEndpoint }: { orderEndpoint: string }) {
  return <div data-order-endpoint={orderEndpoint}>TODO: PayPal v6 button</div>;
}
