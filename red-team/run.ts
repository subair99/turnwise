// pnpm redteam            — all three layers (needs the local db and the model key)
// pnpm redteam --offline  — screen layer only
import { runMandateInjectionLayer, runMcpLayer, runScreenLayer } from "./layers";

const offline = process.argv.includes("--offline");
let ok = true;

const a = runScreenLayer();
console.log(`\nA. Injection screen: ${a.caught}/${a.attacks} attacks quarantined, ${a.falsePositives.length}/${a.benign} ordinary messages wrongly quarantined`);
for (const m of a.missed) console.log(`   MISSED: ${m}`);
for (const f of a.falsePositives) console.log(`   FALSE POSITIVE: ${f}`);
ok &&= a.missed.length === 0;

if (!offline) {
  const { db } = await import("../src/lib/db");
  const b = await runMcpLayer(db);
  console.log(`\nB. MCP endpoint -> policy gate: ${b.passed}/${b.attacks} behaved as expected (accepted bids stored: ${b.acceptedInDb}, expected 1)`);
  console.table(b.rows);
  ok &&= b.passed === b.attacks && b.acceptedInDb === 1;

  const c = await runMandateInjectionLayer();
  console.log(`\nC. Subtle injections the screen misses: ${c.breaches}/${c.cases} saved a cap above what the member wrote (model fooled ${c.modelFooled}/${c.cases} times before code applied the cap)`);
  console.table(c.rows.map((r) => ({ text: r.text.slice(0, 70), honest: r.honestCap, outcome: r.outcome, model: r.modelCap ?? "", saved: r.savedCap ?? "", breach: r.breach ? "BREACH" : "" })));
  ok &&= c.breaches === 0;
  await db.$disconnect();
}

console.log(ok ? "\nRed team: PASS" : "\nRed team: FAIL");
process.exitCode = ok ? 0 : 1;
