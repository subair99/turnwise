// AG Grid AI Toolkit: the client sends the grid's structured schema, its current state and a question.
// The model returns a new grid state as JSON; we validate it against the grid's own schema before the client applies it.
// It can only change how the ledger is viewed (filters, grouping, sorting, aggregation, visible columns), never the data.
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import Ajv from "ajv";
import { model } from "@/lib/model";
import { screen } from "@/agents/quarantine";

const PROPS = ["aggregation", "filter", "sort", "pivot", "columnVisibility", "columnSizing", "rowGroup"];
const DEBUG_FILE = join(tmpdir(), "turnwise-ledger-query.json");

const SYSTEM = `You control an AG Grid that shows a savings circle's ledger. Answer the user's question by returning the grid
state that shows the answer.
Reply with ONE JSON object and nothing else (no code fences, no commentary), shaped like:
{"gridState": {...}, "propertiesToIgnore": [...], "explanation": "..."}
- gridState must follow the JSON Schema you are given exactly. Include only the parts that need to change.
- propertiesToIgnore lists every part you did not change, from: ${PROPS.join(", ")}.
- explanation is one plain sentence saying what the view now shows. You cannot see the data, so don't state numbers.
Hints: late payments are rows where timing is "Late"; missed payments have timing starting with "Missed".
To answer "who did X N times", filter to X and group rows by member so each group shows its count.
To total money per member, group by member and sum amount. Use only columns and values that appear in the schema.`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the reply");
  return JSON.parse(text.slice(start, end + 1));
}

type Reply = { gridState?: unknown; propertiesToIgnore?: unknown; explanation?: unknown };

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

  const { $schema: _draft, ...gridSchema } = input.schema as Record<string, unknown>;
  void _draft;
  const attempts: { reply: string; problems: string }[] = [];
  try {
    const ajv = new Ajv({ strict: false, allErrors: true });
    // AG Grid's schema requires every top-level part. Parts the model leaves alone (propertiesToIgnore) are made optional;
    // everything it does return is still validated in full.
    const required = Array.isArray(gridSchema.required) ? (gridSchema.required as string[]) : [];
    const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
    const validatorFor = (ignore: string[]) => {
      const key = [...ignore].sort().join(",");
      if (!compiled.has(key)) compiled.set(key, ajv.compile({ ...gridSchema, required: required.filter((r) => !ignore.includes(r)) }));
      return compiled.get(key)!;
    };
    let validate = validatorFor([]);
    const base = `JSON Schema for gridState:\n${JSON.stringify(gridSchema)}\n\nCurrent grid state:\n${JSON.stringify(input.gridState ?? {})}\n\nQuestion: ${question}`;
    let out: Reply | null = null;
    // Up to two tries: if the first grid state doesn't fit the grid's schema, show the model exactly why.
    for (let attempt = 1; attempt <= 2 && !out; attempt++) {
      const last = attempts[attempts.length - 1];
      const { text } = await generateText({
        model,
        system: SYSTEM,
        prompt: last ? `${base}\n\nYour previous reply was:\n${last.reply.slice(0, 4000)}\n\nIt failed validation:\n${last.problems}\nReturn a corrected JSON object.` : base,
      });
      let parsed: Reply;
      try {
        parsed = extractJson(text) as Reply;
      } catch (e) {
        attempts.push({ reply: text, problems: (e as Error).message });
        continue;
      }
      const ignored = Array.isArray(parsed.propertiesToIgnore) ? parsed.propertiesToIgnore.filter((p): p is string => typeof p === "string" && PROPS.includes(p)) : [];
      validate = validatorFor(ignored);
      if (parsed.gridState && typeof parsed.gridState === "object" && validate(parsed.gridState)) {
        out = parsed;
        const fm = (out.gridState as { filter?: { filterModel?: Record<string, unknown> } }).filter?.filterModel;
        if (fm) for (const k of Object.keys(fm)) if (fm[k] === null) delete fm[k];
      } else {
        const problems = ajv.errorsText(validate.errors, { separator: "\n" }).slice(0, 1500) || "gridState missing";
        attempts.push({ reply: text, problems });
        console.error(`[ledger query] attempt ${attempt} failed validation:`, problems.slice(0, 400));
      }
    }
    if (!out) writeFileSync(DEBUG_FILE, JSON.stringify({ question, schemaKeys: Object.keys((gridSchema.properties as object) ?? {}), schema: gridSchema, attempts, ok: Boolean(out) }, null, 2));
    if (!out) {
      return NextResponse.json({ gridState: null, explanation: "I couldn't turn that into a valid view of the ledger. Try naming a column, such as timing or member." }, { status: 422 });
    }
    const ignore = Array.isArray(out.propertiesToIgnore) ? out.propertiesToIgnore.filter((p): p is string => typeof p === "string" && PROPS.includes(p)) : [];
    return NextResponse.json({ gridState: out.gridState, propertiesToIgnore: ignore, explanation: typeof out.explanation === "string" ? out.explanation : "Done." });
  } catch (err) {
    console.error("[ledger query]", (err as Error).message);
    try {
      writeFileSync(DEBUG_FILE, JSON.stringify({ question, error: (err as Error).message, stack: (err as Error).stack?.split("\n").slice(0, 6), schemaKeys: Object.keys((gridSchema.properties as object) ?? {}), schema: gridSchema, attempts, ok: false }, null, 2));
    } catch {}
    return NextResponse.json({ gridState: null, explanation: "The ledger assistant couldn't answer that. Try rephrasing, or filter the columns directly." }, { status: 502 });
  }
}
