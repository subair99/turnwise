// AG Grid AI Toolkit: the client sends the grid's structured schema and current state plus a question;
// the model returns a new grid state, which the client validates and applies with setState().
import { NextResponse } from "next/server";

export async function POST(_req: Request) {
  // TODO: generateObject with the JSON schema from getStructuredSchema(); return the state object
  return NextResponse.json({ todo: "AI Toolkit query" }, { status: 501 });
}
