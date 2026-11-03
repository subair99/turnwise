// The Guardian's actions are decided by code; the model only writes the member-facing explanation.
import { generateText } from "ai";
import { model } from "../lib/model";
import { GUARDIAN } from "./prompts";

const FALLBACK: Record<string, string> = {
  send_reminder: "Your contribution is due. Please pay now to keep the circle on track.",
  open_cure_window: "Your contribution is overdue. You still have a short window to pay before your deposit is used.",
  apply_deposit: "Your contribution wasn't paid, so your deposit was used to keep the pot whole, as the charter agreed.",
  create_preauth: "Your next contribution has been authorized and will be taken on the due date.",
  vote: "The deposit didn't cover the missed amount, so the circle will vote on what happens next.",
};

export async function explain(action: string, facts: Record<string, unknown>): Promise<string> {
  try {
    const { text } = await generateText({
      model,
      system: GUARDIAN,
      prompt: `Action taken by code: ${action}\nFacts: ${JSON.stringify(facts)}`,
    });
    return text.trim() || FALLBACK[action] || "Update from your circle.";
  } catch {
    return FALLBACK[action] ?? "Update from your circle.";
  }
}
