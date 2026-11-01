// PayPal webhook endpoint: verify signature -> de-duplicate by event ID -> hand to the ledger.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestWebhook } from "@/gate/webhook-ingest";

export async function POST(req: Request) {
  const event = (await req.json()) as { id: string; event_type: string };
  const result = await ingestWebhook(req.headers, event, db);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
