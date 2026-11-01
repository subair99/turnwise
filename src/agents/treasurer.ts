import { generateObject } from "ai";
import { readFileSync } from "node:fs";
import { model } from "../lib/model";
import { AmendmentDraft, CharterDraft } from "./schemas";
import { screen } from "./quarantine";

const SYSTEM = readFileSync(new URL("./prompts/treasurer.md", import.meta.url), "utf8");

export async function draftCharter(organizerText: string) {
  const q = screen(organizerText);
  if (q.quarantined) return { quarantined: true as const, reasons: q.reasons };
  const { object } = await generateObject({ model, schema: CharterDraft, system: SYSTEM, prompt: organizerText });
  return { quarantined: false as const, draft: object };
}

export async function draftAmendment(charter: unknown, request: string) {
  const q = screen(request);
  if (q.quarantined) return { quarantined: true as const, reasons: q.reasons };
  const { object } = await generateObject({
    model,
    schema: AmendmentDraft,
    system: SYSTEM,
    prompt: `Current charter (approved, frozen):\n${JSON.stringify(charter)}\n\nMember request:\n${request}`,
  });
  return { quarantined: false as const, amendment: object };
}
