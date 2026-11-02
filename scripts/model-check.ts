import { generateObject, generateText } from "ai";
import { z } from "zod";
import { model, MODEL_LABEL } from "../src/lib/model";

const t = await generateText({ model, prompt: "Reply with exactly: Turnwise model OK" });
console.log("text:", t.text);

const o = await generateObject({
  model,
  schema: z.object({ maxDiscountCents: z.number().int(), clarifyingQuestion: z.string().nullable() }),
  prompt: "Member says: 'I need $600 before 15 Dec for shop rent; I can pay up to $40 to go early.' Extract the mandate.",
});
console.log("object:", o.object, "via", MODEL_LABEL);
