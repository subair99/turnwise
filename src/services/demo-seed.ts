// Judge mode.
//  seedSimulatedCircle: an 8-member circle (Lagos, London, Houston; $100 a month) with six cycles of recorded
//    history. Simulated: no PayPal objects, labelled everywhere, never touched by the worker.
//  startLiveCircle: a real circle in the PayPal sandbox, using wallets saved by `pnpm money:loop`.
//    The worker runs it on its own demo clock.
import type { Prisma, PrismaClient } from "@prisma/client";
import { settle } from "@/domain/auction";
import { depositRequired } from "@/domain/deposits";
import { contributionEntry, depositAppliedEntry, settlementEntry, type Entry } from "@/domain/ledger";
import { validateCharter, type CharterBody } from "@/domain/charter";
import { demoSecondsPerDay } from "@/domain/clock";
import { hashObject } from "@/gate/hashing";
import { approveCharter, charterFromText, createCircle } from "./charters";
import { mandateFromText } from "./mandates";

const DAY = 86_400_000;
const INVOICE_PAYERS = new Set(["Efe", "Halima"]);
const PEOPLE: [string, string][] = [
  ["Ada", "Lagos"], ["Bola", "Lagos"], ["Chidi", "London"], ["Dami", "Houston"],
  ["Efe", "London"], ["Funke", "Houston"], ["Gbenga", "Lagos"], ["Halima", "London"],
];

export async function seedSimulatedCircle(db: PrismaClient): Promise<string> {
  const contribution = 10_000;
  const body: CharterBody = {
    contributionCents: contribution, cadence: "monthly", members: 8, turnMode: "auction", depositOn: true,
    defaultSteps: { graceDays: 3, cureHours: 48 }, preauthLeadDays: 5, voteQuorum: 0.5,
    label: `Simulated demo circle ${new Date().toISOString()}`,
  };
  const circle = await db.circle.create({ data: { name: "Lagos–London–Houston Circle", mode: "simulated", status: "active" } });
  const members = [];
  for (const [name, city] of PEOPLE) {
    members.push(await db.member.create({ data: { circleId: circle.id, displayName: name, city, paypalEmail: `${name.toLowerCase()}.${circle.id}@simulated.invalid`, vaultId: INVOICE_PAYERS.has(name) ? null : "simulated-wallet" } }));
  }
  const by = Object.fromEntries(members.map((m) => [m.displayName, m]));
  const id = (name: string) => by[name]!.id;
  const charterHash = hashObject(body);
  await db.charter.create({
    data: { circleId: circle.id, version: 1, hash: charterHash, body: body as unknown as Prisma.InputJsonValue, frozen: true, approvals: members.map((m) => m.id) },
  });

  const caps: Record<string, number> = { Ada: 4000, Bola: 0, Chidi: 2000, Dami: 1500, Efe: 0, Funke: 3000, Gbenga: 2500, Halima: 0 };
  const needs: Record<string, string> = {
    Ada: "I need the pot early for shop stock before the December rush. I'll pay up to $40 to go first.",
    Bola: "I'm saving for my son's school fees in January. I won't pay anything to go early.",
    Chidi: "Rent renewal is due in the summer. Up to $20 to collect before August.",
    Dami: "I'd like the pot before my trip home. I'll pay at most $15.",
    Efe: "No rush for me. No discount from me.",
    Funke: "Car repairs coming up. I can pay up to $30 to go early.",
    Gbenga: "Expanding my stall. Up to $25 for an early turn.",
    Halima: "I can wait until the end. I won't pay to go early.",
  };
  for (const m of members) {
    const b = { maxDiscountCents: caps[m.displayName]!, minAcceptCents: 0, deadline: null, targetCents: null, notes: [], memberId: m.id, simulated: true };
    await db.mandate.create({ data: { memberId: m.id, hash: hashObject(b), body: b as unknown as Prisma.InputJsonValue, sourceText: needs[m.displayName]! } });
  }

  const due = (k: number) => new Date(Date.UTC(2026, 3 + k, 5)); // cycle 1 due 5 May 2026 ... cycle 8 due 5 Dec 2026
  for (let k = 1; k <= 8; k++) await db.cycle.create({ data: { circleId: circle.id, number: k, dueAt: due(k), state: k <= 6 ? "closed" : k === 7 ? "collecting" : "pending" } });

  // Recorded history: who bid what, who paid late, one missed payment covered by a deposit.
  const bids: Record<number, [string, number, string][]> = {
    1: [["Ada", 4000, "Ada needs stock before December, so I bid her full $40 cap."], ["Funke", 2500, "Repairs can wait a month; bidding below her cap."], ["Gbenga", 2000, "An early turn helps the stall; a moderate bid."], ["Chidi", 1000, "His deadline is August; a small bid."], ["Bola", 0, "Bola won't pay to go early."], ["Dami", 0, "Holding back for a later cycle."], ["Efe", 0, "Efe is in no rush."], ["Halima", 0, "Halima waits until the end."]],
    2: [["Gbenga", 2500, "His full $25 cap: the stall lease is close."], ["Funke", 2400, "Close to her cap; repairs are getting urgent."], ["Chidi", 800, "Still well before August."], ["Dami", 500, "A small bid."]],
    3: [["Funke", 3000, "Her full $30 cap; the car can't wait."], ["Chidi", 1200, "Raising the bid as August nears."], ["Dami", 900, "A modest bid."]],
    4: [["Chidi", 2000, "August is close: his full $20 cap."], ["Dami", 1500, "His full cap, but Chidi's deadline comes first."]],
    5: [["Dami", 1500, "His full $15 cap for the trip home."], ["Bola", 0, "Bola won't pay to go early."], ["Efe", 0, "No discount from Efe."], ["Halima", 0, "Halima waits until the end."]],
    6: [["Bola", 0, "No discount; the earliest of the zero bids."], ["Efe", 0, "No discount from Efe."], ["Halima", 0, "Halima waits until the end."]],
  };
  const outside: Record<number, [string, number, string]> = { 1: ["Dami", 5000, "over mandate cap"], 5: ["Bola", 2000, "over mandate cap"] };
  const late: Record<number, string[]> = { 2: ["Chidi"], 3: ["Chidi"], 5: ["Efe"] };
  const missed: Record<number, string[]> = { 5: ["Funke"] };

  const memberIds = members.map((m) => m.id); // ordered as created (ids ascend)
  const collected = new Map<string, number>();
  const deposits = new Map<string, number>();
  let seq = 0;
  const entry = async (e: Entry, at: Date, key: string) =>
    db.ledgerEntry.create({ data: { circleId: circle.id, description: e.description, postings: e.postings as unknown as Prisma.InputJsonValue, requestId: `sim:${circle.id}:${key}`, createdAt: at } });
  const audit = (agent: string, kind: string, at: Date, extra: Record<string, unknown>, allowed = true, reasons: string[] = []) =>
    db.auditLog.create({ data: { circleId: circle.id, agent, model: "simulated", proposal: { kind, simulated: true, ...extra } as unknown as Prisma.InputJsonValue, allowed, reasons, charterHash, createdAt: at } });
  const note = (cycleNumber: number, memberId: string | null, kind: string, text: string, at: Date) =>
    db.notice.create({ data: { circleId: circle.id, cycleNumber, memberId, kind, text, createdAt: at } });

  for (let k = 1; k <= 6; k++) {
    const d = due(k);
    for (const m of members) {
      const name = m.displayName;
      const isLate = late[k]?.includes(name) ?? false;
      const isMissed = missed[k]?.includes(name) ?? false;
      const method = INVOICE_PAYERS.has(name) ? "invoice" : k === 1 ? "payin_order" : "preauth";
      if (isMissed) {
        const applied = Math.min(deposits.get(m.id) ?? 0, contribution);
        await db.contribution.create({ data: { circleId: circle.id, memberId: m.id, cycleNumber: k, amountCents: contribution, method, status: "covered", ladderStep: "resolved", createdAt: d } });
        await note(k, m.id, "reminder", `${name}, your cycle ${k} contribution is due. Please pay to keep the circle on track.`, new Date(d.getTime() + 1 * DAY));
        await note(k, m.id, "cure_window", `${name}, your contribution is overdue. You have 48 hours before your deposit is used.`, new Date(d.getTime() + 3 * DAY));
        await entry(depositAppliedEntry(m.id, k, applied), new Date(d.getTime() + 5 * DAY), `dep:${k}:${m.id}`);
        await audit("guardian", "apply_deposit", new Date(d.getTime() + 5 * DAY), { memberId: m.id, cycle: k, amount: applied });
        await note(k, m.id, "deposit_applied", `${name}'s $${applied / 100} deposit was used to keep the cycle ${k} pot whole, as the charter agreed.`, new Date(d.getTime() + 5 * DAY));
        deposits.set(m.id, (deposits.get(m.id) ?? 0) - applied);
        continue;
      }
      const paidAt = new Date(d.getTime() + (isLate ? 2.5 : -((seq++ % 3) + 0.5)) * DAY);
      await db.contribution.create({
        data: { circleId: circle.id, memberId: m.id, cycleNumber: k, amountCents: contribution, method, status: "paid", ladderStep: isLate ? "reminded" : "current", paidAt, createdAt: d },
      });
      if (isLate) await note(k, m.id, "reminder", `${name}, your cycle ${k} contribution is due. Please pay to keep the circle on track.`, new Date(d.getTime() + 1 * DAY));
      await entry(contributionEntry(m.id, k, contribution), paidAt, `c:${k}:${m.id}`);
      await audit(method === "preauth" ? "guardian" : "member", method === "preauth" ? "capture_preauth" : method === "invoice" ? "send_invoice" : "capture_payin", paidAt, { memberId: m.id, cycle: k, amount: contribution });
    }

    // Auction: sealed bids, gate checks, highest valid bid wins.
    const cycle = await db.cycle.findUniqueOrThrow({ where: { circleId_number: { circleId: circle.id, number: k } } });
    const opened = new Date(d.getTime() + 6 * DAY);
    let i = 0;
    for (const [name, discount, explanation] of bids[k] ?? []) {
      const placedAt = new Date(opened.getTime() + ++i * 3_600_000);
      await db.bid.create({ data: { cycleId: cycle.id, memberId: id(name), discountCents: discount, source: "turn-agent", accepted: true, explanation, placedAt } });
      await audit(`turn-agent:${name}`, "accept_bid", placedAt, { memberId: id(name), cycle: k, discount });
    }
    const o = outside[k];
    if (o) {
      const placedAt = new Date(opened.getTime() + 30 * 60_000);
      await db.bid.create({ data: { cycleId: cycle.id, memberId: id(o[0]), discountCents: o[1], source: "mcp", accepted: false, gateReason: o[2], explanation: "Bid from an outside assistant", placedAt } });
      await audit("mcp", "accept_bid", placedAt, { memberId: id(o[0]), cycle: k, discount: o[1] }, false, [o[2]]);
    }
    const [winnerName, discount] = (bids[k] ?? [])[0]!;
    const winnerId = id(winnerName);
    const s = settle({ contribution, memberIds, winnerId, discount, depositOn: depositRequired(k, 8, true) });
    const settledAt = new Date(opened.getTime() + 2 * DAY);
    await entry(settlementEntry(k, s), settledAt, `s:${k}`);
    await audit("treasurer", "payout_batch", settledAt, { cycle: k, items: [{ memberId: winnerId, amount: s.winnerPayout }, ...s.dividends] });
    await db.cycle.update({ where: { id: cycle.id }, data: { winnerId, discountCents: discount, auctionOpenedAt: opened } });
    collected.set(winnerId, k);
    deposits.set(winnerId, (deposits.get(winnerId) ?? 0) + s.deposit);
    await note(k, winnerId, "payout", `${winnerName} collects cycle ${k}: $${s.winnerPayout / 100}${s.deposit ? `, with $${s.deposit / 100} held as a deposit until they finish` : ""}${discount ? `. Their $${discount / 100} discount was shared with the other seven` : ""}.`, settledAt);
  }

  for (const m of members) {
    await db.member.update({ where: { id: m.id }, data: { collectedCycle: collected.get(m.id) ?? null, depositCents: Math.max(0, deposits.get(m.id) ?? 0) } });
  }
  // Cycle 7 is collecting: members who collected are pre-authorized; Efe and Halima are still due.
  for (const m of members) {
    const pre = !INVOICE_PAYERS.has(m.displayName);
    await db.contribution.create({ data: { circleId: circle.id, memberId: m.id, cycleNumber: 7, amountCents: contribution, method: pre ? "preauth" : "invoice", status: pre ? "preauthorized" : "due", createdAt: new Date(due(7).getTime() - 5 * DAY) } });
  }
  return circle.id;
}

function savedVaultsFromEnv(): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of (process.env.SANDBOX_VAULTS ?? "").split(",")) {
    const [email, vault] = pair.split("=").map((x) => x?.trim());
    if (email && vault) out.set(email, vault);
  }
  return out;
}

export async function liveReadiness(db: PrismaClient) {
  const emails = (process.env.SANDBOX_MEMBER_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean).slice(0, 8);
  const env = savedVaultsFromEnv();
  const ready: { email: string; vaultId: string }[] = [];
  const missing: string[] = [];
  for (const email of emails) {
    const m = await db.member.findFirst({ where: { paypalEmail: email, vaultId: { not: null } }, orderBy: { id: "desc" } });
    const vaultId = m?.vaultId ?? env.get(email);
    if (vaultId) ready.push({ email, vaultId });
    else missing.push(email);
  }
  return { emails, ready, missing };
}

export async function startLiveCircle(db: PrismaClient): Promise<string> {
  const { emails, ready, missing } = await liveReadiness(db);
  if (emails.length < 2) throw new Error("Set SANDBOX_MEMBER_EMAILS to at least 2 sandbox personal accounts.");
  if (missing.length) throw new Error(`No saved PayPal wallet for ${missing.join(", ")}. Run pnpm money:loop once, or set SANDBOX_VAULTS.`);
  const n = ready.length;
  let body: CharterBody | null = null;
  try {
    const d = await charterFromText(`${n} of us, $5 a month, auction mode, 3 grace days, 48-hour cure window, deposits on, authorize payments 5 days before each due date.`, n);
    if (d.ok) body = d.body;
  } catch {
    body = null; // model unavailable: fall back to the same rules, drafted by code
  }
  body ??= validateCharter({ contributionCents: 500, cadence: "monthly", members: n, turnMode: "auction", depositOn: true, graceDays: 3, cureHours: 48, preauthLeadDays: 5, voteQuorum: 0.5 }).body;

  const secondsPerDay = demoSecondsPerDay() || 0.7;
  const { circle, charter, members } = await createCircle(
    db,
    { name: "Live sandbox circle", body, members: ready.map((r, i) => ({ displayName: PEOPLE[i]![0], city: PEOPLE[i]![1], email: r.email, vaultId: r.vaultId })) },
    { mode: "live", clock: { secondsPerDay, startedAt: new Date() } },
  );
  for (const m of members) await approveCharter(db, charter.id, m.id);
  const needs = ["I need my payout early for shop rent. I'll pay up to $2 to go first.", "I'm saving for school fees, so I can wait for a later turn. I won't pay anything to go early."];
  for (const [i, m] of members.entries()) await mandateFromText(db, m.id, needs[i] ?? "I can wait and won't pay to go early.");
  await db.member.update({ where: { id: members[0]!.id }, data: { simulateMissCycle: 2 } });
  // Due dates restart from now, so setup time doesn't use up cycle 1.
  const started = new Date();
  await db.circle.update({ where: { id: circle.id }, data: { clockStartedAt: started } });
  for (let k = 1; k <= n; k++) {
    await db.cycle.update({ where: { circleId_number: { circleId: circle.id, number: k } }, data: { dueAt: new Date(started.getTime() + k * 30 * DAY) } });
  }
  return circle.id;
}
