// Starts a member's pay-in for a cycle and returns the PayPal approval link.
// TODO (Stage 6): take the member from the session instead of the request body.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startPayin } from "@/services/payins";

const base = () => process.env.APP_BASE_URL ?? "https://turnwise-web.onrender.com";

export async function POST(req: Request) {
  const { circleId, memberId, cycle } = (await req.json()) as { circleId: string; memberId: string; cycle: number };
  if (!circleId || !memberId || !Number.isInteger(cycle)) {
    return NextResponse.json({ error: "circleId, memberId and cycle are required" }, { status: 400 });
  }
  try {
    const result = await startPayin(db, circleId, memberId, cycle, {
      returnUrl: `${base()}/api/paypal/return`,
      cancelUrl: `${base()}/circles/${circleId}/ledger?paypal=cancelled`,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
