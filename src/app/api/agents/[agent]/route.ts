import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const { text } = (await req.json()) as { text: string };
  // TODO: route to treasurer / turn-agent / guardian; every result is a proposal or an explanation
  return NextResponse.json({ agent, received: text, todo: "wire agent" }, { status: 501 });
}
