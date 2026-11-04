// AG Grid AI Toolkit: the client sends the grid's structured schema, its current state and a question.
// The model returns a new grid state as JSON. We complete it (missing nullable fields become null, which AG Grid's
// strict schema uses for "not set"), validate it against the grid's own schema, and only then return it.
// It can only change how the ledger is viewed (filters, grouping, sorting, aggregation, visible columns), never the data.
import { NextResponse } from "next/server";
import { generateText } from "ai";
import Ajv from "ajv";
import { model } from "@/lib/model";
import { screen } from "@/agents/quarantine";

const PROPS = ["aggregation", "filter", "sort", "pivot", "columnVisibility", "columnSizing", "rowGroup"];

const SYSTEM = `You control an AG Grid that shows a savings circle's ledger. Answer the user's question by returning the grid
state that shows the answer.
Reply with ONE JSON object and nothing else (no code fences, no commentary), shaped like:
{"gridState": {...}, "propertiesToIgnore": [...], "explanation": "..."}
- gridState must follow the JSON Schema you are given. Include only the parts that need to change.
- Inside a part you include, give every field the schema requires; use null for anything you are not setting.
- propertiesToIgnore lists every part you did not change, from: ${PROPS.join(", ")}.
- explanation is one plain sentence saying what the view now shows. You cannot see the data, so don't state numbers.
Hints: late payments are rows where timing is "Late"; missed payments have timing starting with "Missed".
To answer "who did X N times", filter to X and group rows by member so each group shows its count.
To total money per member, group by member and sum amount. Use only columns and values that appear in the schema.`;

type Schema = { type?: string | string[]; properties?: Record<string, Schema>; required?: string[]; anyOf?: Schema[]; oneOf?: Schema[]; items?: Schema; $ref?: string; [k: string]: unknown };
type Reply = { gridState?: unknown; propertiesToIgnore?: unknown; explanation?: unknown };

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the reply");
  return JSON.parse(text.slice(start, end + 1));
}

function resolve(s: Schema | undefined, root: Schema): Schema | undefined {
  if (!s?.$ref?.startsWith("#/")) return s;
  return s.$ref.slice(2).split("/").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], root) as Schema | undefined;
}

function allowsNull(s: Schema | undefined, root: Schema): boolean {
  const r = resolve(s, root);
  if (!r) return false;
  if (r.type === "null" || (Array.isArray(r.type) && r.type.includes("null"))) return true;
  return [...(r.anyOf ?? []), ...(r.oneOf ?? [])].some((x) => allowsNull(x, root));
}

// Adds null for required-but-missing fields that the schema allows to be null, recursively. Never changes a value given.
function completeNulls(value: unknown, s: Schema | undefined, root: Schema): void {
  const r = resolve(s, root);
  if (!r || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) completeNulls(v, r.items, root);
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const branch of [...(r.anyOf ?? []), ...(r.oneOf ?? [])]) {
    const b = resolve(branch, root);
    if (b?.properties) completeNulls(obj, b, root);
  }
  if (!r.properties) return;
  for (const key of r.required ?? []) {
    if (!(key in obj) && allowsNull(r.properties[key], root)) obj[key] = null;
  }
  for (const [key, v] of Object.entries(obj)) completeNulls(v, r.properties[key], root);
}

export async function POST(req: Request) {
  let input: { question?: unknown; gridState?: unknown; schema?: unknown };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ gridState: null, explanation: "The request wasn't valid." }, { status: 400 });
  }
  const question = typeof input.question === "string" ? input.question.trim().slice(0, 300) : "";
  if (!question || typeof input.schema !== "object" || input.schema === null) {
    return NextResponse.json({ gridState: null, explanation: "Ask a question about the ledger." }, { status: 400 });
  }
  if (screen(question).quarantined) {
    return NextResponse.json({ gridState: null, explanation: "That reads like an instruction to the system, not a question about the ledger. The ledger can only be filtered, grouped and sorted." });
  }

  const { $schema: _draft, ...gridSchema } = input.schema as Schema & { $schema?: unknown };
  const required = Array.isArray(gridSchema.required) ? gridSchema.required : [];
  let raw = "";
  let problems = "";
  try {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
    // Top-level parts the model leaves alone (propertiesToIgnore) are optional; everything it returns is validated in full.
    const validatorFor = (ignore: string[]) => {
      const key = [...ignore].sort().join(",");
      if (!compiled.has(key)) compiled.set(key, ajv.compile({ ...gridSchema, required: required.filter((r) => !ignore.includes(r)) }));
      return compiled.get(key)!;
    };
    const base = `JSON Schema for gridState:\n${JSON.stringify(gridSchema)}\n\nCurrent grid state:\n${JSON.stringify(input.gridState ?? {})}\n\nQuestion: ${question}`;
    let out: Reply | null = null;
    for (let attempt = 1; attempt <= 2 && !out; attempt++) {
      const { text } = await generateText({
        model,
        system: SYSTEM,
        prompt: attempt === 1 ? base : `${base}\n\nYour previous reply was:\n${raw.slice(0, 4000)}\n\nIt failed validation:\n${problems}\nReturn a corrected JSON object.`,
      });
      raw = text;
      let parsed: Reply;
      try {
        parsed = extractJson(text) as Reply;
      } catch (e) {
        problems = (e as Error).message;
        continue;
      }
      const ignored = Array.isArray(parsed.propertiesToIgnore) ? parsed.propertiesToIgnore.filter((p): p is string => typeof p === "string" && PROPS.includes(p)) : [];
      if (parsed.gridState && typeof parsed.gridState === "object") completeNulls(parsed.gridState, gridSchema, gridSchema);
      const validate = validatorFor(ignored);
      if (parsed.gridState && typeof parsed.gridState === "object" && validate(parsed.gridState)) {
        out = { ...parsed, propertiesToIgnore: ignored };
      } else {
        problems = ajv.errorsText(validate.errors, { separator: "\n" }).slice(0, 1500) || "gridState missing";
        console.error(`[ledger query] attempt ${attempt} failed validation:`, problems.slice(0, 600));
      }
    }
    if (!out) {
      return NextResponse.json({ gridState: null, explanation: "I couldn't turn that into a valid view of the ledger. Try naming a column, such as timing or member.", detail: problems.slice(0, 600) }, { status: 422 });
    }
    // Validated as sent; now drop "no filter" entries so only real filters are applied.
    const fm = (out.gridState as { filter?: { filterModel?: Record<string, unknown> } }).filter?.filterModel;
    if (fm) for (const k of Object.keys(fm)) if (fm[k] === null) delete fm[k];
    return NextResponse.json({ gridState: out.gridState, propertiesToIgnore: out.propertiesToIgnore, explanation: typeof out.explanation === "string" ? out.explanation : "Done." });
  } catch (err) {
    console.error("[ledger query]", (err as Error).message, raw ? `| reply started: ${raw.slice(0, 200)}` : "");
    return NextResponse.json({ gridState: null, explanation: "The ledger assistant couldn't answer that. Try rephrasing, or filter the columns directly.", detail: (err as Error).message.slice(0, 300) }, { status: 502 });
  }
}
