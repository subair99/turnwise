// Stage 3 money loop, end to end against the PayPal sandbox and your LOCAL database.
//   Cycle 1: each member pays in (approve once; saves their wallet) -> settle: winner payout + dividends, deposit held
//   Replay:  the same payout is sent through the gate again and must be refused (idempotency)
//   Cycle 2: each contribution is pre-authorized from the saved wallet (no approval) and captured -> settle
//   Close:   deposits refunded; ledger must balance with every pot and the circle cash at $0.00
// Run: pnpm money:loop   (needs the local db running and SANDBOX_MEMBER_EMAILS with 2+ sandbox personal accounts)
import { createInterface } from "node:readline/promises";
import { db } from "../src/lib/db";
import { hashObject } from "../src/gate/hashing";
import { formatMoney } from "../src/lib/money";
import { accounts } from "../src/domain/ledger";
import { completePayin, startPayin } from "../src/services/payins";
import { captureDue, preauthorize } from "../src/services/preauth";
import { refundDeposit, setCycleState, settleCycle } from "../src/services/settlement";
import { loadBalances } from "../src/services/ledger-store";
import { gateFor } from "../src/services/gate-context";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const base = process.env.APP_BASE_URL ?? "https://turnwise-web.onrender.com";
const emails = (process.env.SANDBOX_MEMBER_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
if (emails.length < 2) throw new Error("Set SANDBOX_MEMBER_EMAILS to at least 2 sandbox personal-account emails.");

const CONTRIBUTION = 500; // $5.00
const NAMES = ["Ada", "Bola", "Chidi", "Dami", "Efe", "Funke", "Gbenga", "Halima"];
const checks: { check: string; result: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => checks.push({ check: name, result: `${ok ? "PASS" : "FAIL"}${detail ? ` — ${detail}` : ""}` });

// ---- Circle -------------------------------------------------------------
const n = emails.length;
const charterBody = {
  contributionCents: CONTRIBUTION,
  cadence: "monthly",
  members: n,
  turnMode: "auction",
  depositOn: true,
  defaultSteps: { graceDays: 3, cureHours: 48 },
  preauthLeadDays: 5,
  voteQuorum: 0.5,
  label: `money-loop ${new Date().toISOString()}`,
};
const circle = await db.circle.create({ data: { name: `Money loop ${new Date().toISOString()}` } });
await db.charter.create({ data: { circleId: circle.id, version: 1, hash: hashObject(charterBody), body: charterBody, frozen: true, approvals: [] } });
const members = [];
for (const [i, email] of emails.entries()) {
  members.push(await db.member.create({ data: { circleId: circle.id, displayName: NAMES[i] ?? `Member ${i + 1}`, paypalEmail: email } }));
}
for (let k = 1; k <= n; k++) {
  await db.cycle.create({ data: { circleId: circle.id, number: k, dueAt: new Date(Date.now() + k * 30 * 86_400_000), state: k === 1 ? "collecting" : "pending" } });
}
console.log(`Circle ${circle.id}: ${n} members x ${formatMoney(CONTRIBUTION)}, deposit on\n`);

const [first, second] = [members[0]!, members[1]!];

// ---- Cycle 1: pay-ins that save each wallet ------------------------------
console.log("CYCLE 1 — pay-ins (approve each in a private window, logged in as that member's sandbox account)");
for (const m of members) {
  const p = await startPayin(db, circle.id, m.id, 1, { returnUrl: `${base}/?paypal=approved`, cancelUrl: `${base}/?paypal=cancelled` });
  if (p.alreadyPaid) continue;
  console.log(`\n${m.displayName} (${m.paypalEmail}):\n${p.approveUrl}`);
  await rl.question("Press Enter after approving... ");
  const done = await completePayin(db, p.orderId);
  const saved = await db.member.findUniqueOrThrow({ where: { id: m.id } });
  console.log(`  paid: capture ${done.captureId}; wallet saved: ${saved.vaultId ? "yes" : "no"}`);
  check(`cycle 1 pay-in ${m.displayName}`, Boolean(done.captureId));
  check(`wallet saved ${m.displayName}`, Boolean(saved.vaultId));
}

const s1 = await settleCycle(db, circle.id, 1, first.id, 100); // $1.00 discount
if (!s1.settled) throw new Error(`Cycle 1 not settled: ${s1.reasons.join("; ")}`);
console.log(`\nCycle 1 settled: ${first.displayName} gets ${formatMoney(s1.settlement.winnerPayout)}, deposit ${formatMoney(s1.settlement.deposit)}, batch ${s1.payoutBatchId}`);
check("cycle 1 payout batch", Boolean(s1.payoutBatchId), s1.payoutBatchId);

// ---- Replay: same payout through the gate --------------------------------
{
  const g = await gateFor(db, circle.id, 1, "replay-test");
  const items = [{ memberId: first.id, amount: s1.settlement.winnerPayout }, ...s1.settlement.dividends].filter((i) => i.amount > 0);
  const replay = await g.run({ kind: "payout_batch", circleId: circle.id, cycle: 1, charterHash: g.charterHash, items });
  check("replayed payout refused by gate", !replay.allowed, replay.reasons.join("; "));
}

// ---- Cycle 2: pre-authorized from saved wallets, captured on the due date ----
console.log("\nCYCLE 2 — pre-authorize from saved wallets (no approval), then capture");
await setCycleState(db, circle.id, 2, "collecting");
for (const m of members) {
  const pre = await preauthorize(db, circle.id, m.id, 2);
  if (!pre.authorizationId) {
    check(`cycle 2 pre-auth ${m.displayName}`, false, `no saved wallet; one-tap link: ${pre.approveUrl}`);
    continue;
  }
  console.log(`  ${m.displayName}: authorization ${pre.authorizationId} (expires ${pre.expiresAt?.toISOString()})`);
  const paid = await captureDue(db, circle.id, m.id, 2);
  console.log(`  ${m.displayName}: captured ${paid.captureId}`);
  check(`cycle 2 pre-auth + capture ${m.displayName}`, Boolean(paid.captureId));
}

const s2 = await settleCycle(db, circle.id, 2, second.id, 0);
if (!s2.settled) throw new Error(`Cycle 2 not settled: ${s2.reasons.join("; ")}`);
console.log(`Cycle 2 settled: ${second.displayName} gets ${formatMoney(s2.settlement.winnerPayout)}, deposit ${formatMoney(s2.settlement.deposit)}, batch ${s2.payoutBatchId}`);
check("cycle 2 payout batch", Boolean(s2.payoutBatchId), s2.payoutBatchId);

// ---- Close: refund deposits (as if every member finished) -----------------
for (const m of members) {
  const r = await refundDeposit(db, circle.id, m.id);
  if (r.refunded) console.log(`Deposit refunded to ${m.displayName}: batch ${r.payoutBatchId}`);
}

// ---- Ledger checks ---------------------------------------------------------
const bal = await loadBalances(db, circle.id);
console.log("\nLedger balances (positive = net debit):");
console.table([...bal.entries()].map(([account, cents]) => ({ account, balance: formatMoney(cents) })));
const pots = [1, 2].map((k) => bal.get(accounts.pot(k)) ?? 0);
check("cycle pots cleared", pots.every((p) => p === 0), pots.map((p) => formatMoney(p)).join(", "));
check("circle cash back to $0.00", (bal.get(accounts.cash) ?? 0) === 0, formatMoney(bal.get(accounts.cash) ?? 0));
const depositLeft = members.reduce((s, m) => s + (bal.get(accounts.deposit(m.id)) ?? 0), 0);
check("deposit liabilities cleared", depositLeft === 0, formatMoney(depositLeft));
check("ledger sums to zero", [...bal.values()].reduce((a, b) => a + b, 0) === 0);

const audit = await db.auditLog.findMany({ where: { circleId: circle.id }, orderBy: { createdAt: "asc" } });
console.log("\nAudit log:");
console.table(audit.map((a) => ({ agent: a.agent, kind: (a.proposal as { kind?: string }).kind, allowed: a.allowed, paypalId: a.paypalId ?? "", reasons: (a.reasons as string[]).join("; ") })));

console.log("\nResults:");
console.table(checks);
rl.close();
await db.$disconnect();
process.exitCode = checks.every((c) => c.result.startsWith("PASS")) ? 0 : 1;
