import { generateObject } from "ai";
import { model } from "../lib/model";
import { AmendmentDraft, CharterDraft } from "./schemas";
import { TREASURER } from "./prompts";
import { screen } from "./quarantine";

export async function draftCharter(organizerText: string) {
  const q = screen(organizerText);
  if (q.quarantined) return { quarantined: true as const, reasons: q.reasons };
  const { object } = await generateObject({ model, schema: CharterDraft, system: TREASURER, prompt: organizerText });
  return { quarantined: false as const, draft: object };
}

export async function draftAmendment(charter: unknown, request: string) {
  const q = screen(request);
  if (q.quarantined) return { quarantined: true as const, reasons: q.reasons };
  const { object } = await generateObject({
    model,
    schema: AmendmentDraft,
    system: TREASURER,
    prompt: `Approved charter (frozen):\n${JSON.stringify(charter)}\n\nMember request:\n${request}\n\nWhich rules would change, and to what?`,
  });
  return { quarantined: false as const, amendment: object };
}
