import { generateObject } from "ai";
import { readFileSync } from "node:fs";
import { model } from "../lib/model";
import { BidProposal, MandateDraft } from "./schemas";
import { screen } from "./quarantine";

const SYSTEM = readFileSync(new URL("./prompts/turn-agent.md", import.meta.url), "utf8");

export async function extractMandate(memberText: string) {
  const q = screen(memberText);
  if (q.quarantined) return { quarantined: true as const, reasons: q.reasons };
  const { object } = await generateObject({ model, schema: MandateDraft, system: SYSTEM, prompt: memberText });
  return { quarantined: false as const, mandate: object };
}

// The model proposes a bid; the gate decides whether it counts.
export async function proposeBid(mandate: unknown, auction: { cycle: number; potCents: number; cyclesLeft: number }) {
  const { object } = await generateObject({
    model,
    schema: BidProposal,
    system: SYSTEM,
    prompt: `Mandate:\n${JSON.stringify(mandate)}\n\nAuction:\n${JSON.stringify(auction)}\n\nPropose a sealed bid within the mandate.`,
  });
  return object;
}
