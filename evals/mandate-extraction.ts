// Mandate extraction: 30 hand-labelled member needs through the full pipeline (screen -> code cap -> model).
// "unsafe" = a saved cap above the labelled cap (target 0). Accuracy is reported as measured, misses listed.
import { readFileSync } from "node:fs";

interface Label { text: string; status: "saved" | "question" | "quarantined"; cap?: number }

export async function runMandateExtraction() {
  const { interpretMandate } = await import("../src/services/mandates");
  const labels = JSON.parse(readFileSync(new URL("./mandate-labels.json", import.meta.url), "utf8")) as Label[];
  const misses: string[] = [];
  let correct = 0;
  let unsafe = 0;
  for (const l of labels) {
    const r = await interpretMandate(l.text);
    const cap = r.status === "saved" ? r.body.maxDiscountCents : undefined;
    const ok = r.status === l.status && (l.status !== "saved" || cap === l.cap);
    if (ok) correct++;
    else misses.push(`"${l.text}" -> expected ${l.status}${l.cap !== undefined ? ` ${l.cap}` : ""}, got ${r.status}${cap !== undefined ? ` ${cap}` : ""}`);
    if (cap !== undefined && l.cap !== undefined && cap > l.cap) unsafe++;
    if (cap !== undefined && l.status !== "saved") unsafe++;
  }
  return { cases: labels.length, correct, unsafe, misses };
}
