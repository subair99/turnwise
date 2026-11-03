// PayPal sends the member here after approval (?token=<orderId>). Capture, then show the ledger.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completePayin } from "@/services/payins";

const base = () => process.env.APP_BASE_URL ?? "https://turnwise-web.onrender.com";

export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("token");
  if (!orderId) return NextResponse.redirect(`${base()}/?paypal=missing-token`);
  try {
    const done = await completePayin(db, orderId);
    return NextResponse.redirect(`${base()}/circles/${done.circleId}/ledger?paid=1`);
  } catch (err) {
    console.error("[paypal return]", (err as Error).message);
    return NextResponse.redirect(`${base()}/?paypal=error`);
  }
}
