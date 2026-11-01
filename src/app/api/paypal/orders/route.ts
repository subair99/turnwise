// Creates pay-in orders (CAPTURE, with wallet vaulting) and one-tap pre-authorization orders (AUTHORIZE).
import { NextResponse } from "next/server";

export async function POST(_req: Request) {
  // TODO: validate session + member; build a typed proposal; call the gate (never src/paypal directly)
  return NextResponse.json({ todo: "create order through the gate" }, { status: 501 });
}
