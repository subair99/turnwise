// The Guardian's schedule is deterministic; the model only writes the member-facing explanation.
import { generateText } from "ai";
import { readFileSync } from "node:fs";
import { model } from "../lib/model";
import type { LadderAction } from "../domain/default-ladder";

const SYSTEM = readFileSync(new URL("./prompts/guardian.md", import.meta.url), "utf8");

export async function explain(action: LadderAction | "create_preauth" | "capture_preauth", facts: Record<string, unknown>) {
  const { text } = await generateText({
    model,
    system: SYSTEM,
    prompt: `Action taken by code: ${action}\nFacts: ${JSON.stringify(facts)}\nExplain this to the member in two short sentences.`,
  });
  return text;
}
