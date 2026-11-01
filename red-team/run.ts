import payloads from "./payloads.json" with { type: "json" };
import { screen } from "../src/agents/quarantine";

let caught = 0;
for (const p of payloads as string[]) {
  const r = screen(p);
  if (r.quarantined) caught++;
  else console.log(`MISSED: ${p}`);
}
console.log(`Injection resistance: ${caught}/${payloads.length} quarantined`);
process.exitCode = caught === payloads.length ? 0 : 1;
