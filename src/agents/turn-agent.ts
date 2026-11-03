import { generateObject } from "ai";
import { model } from "../lib/model";
import { BidProposal, MandateDraft } from "./schemas";
import { TURN_AGENT } from "./prompts";
import { screen } from "./quarantine";

export async function extractMandate(memberText: string, today = new Date()) {
  const q = screen(memberText);
  if (q.quarantined) return { quarantined: true as const, reasons: q.reasons };
  const { object } = await generateObject({
    model,
    schema: MandateDraft,
    system: TURN_AGENT,
    prompt: `Today is ${today.toISOString().slice(0, 10)}.\nMember says: ${memberText}`,
  });
  return { quarantined: false as const, mandate: object };
}

export async function proposeBid(
  mandate: unknown,
  auction: { cycle: number; potCents: number; cyclesLeft: number; today: string },
) {
  const { object } = await generateObject({
    model,
    schema: BidProposal,
    system: TURN_AGENT,
    prompt: `Mandate:\n${JSON.stringify(mandate)}\n\nAuction:\n${JSON.stringify(auction)}\n\nPropose one sealed bid (discount in cents) within the mandate.`,
  });
  return object;
}
