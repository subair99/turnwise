// PayPal webhook endpoint: verify signature -> de-duplicate by event ID -> update state and ledger.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestWebhook } from "@/gate/webhook-ingest";

export async function POST(req: Request) {
  let event: { id: string; event_type: string; resource?: Record<string, unknown> };
  try {
    event = (await req.json()) as typeof event;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid JSON" }, { status: 400 });
  }
  if (!event?.id || !event?.event_type) {
    return NextResponse.json({ ok: false, reason: "missing id or event_type" }, { status: 400 });
  }
  try {
    const result = await ingestWebhook(req.headers, event, db);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("[webhook] rejected", event.event_type, (err as Error).message);
    return NextResponse.json({ ok: false, reason: "verification or processing failed" }, { status: 400 });
  }
}
