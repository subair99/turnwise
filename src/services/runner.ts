// Moves each circle forward: pending -> collecting -> auction -> closed; refunds deposits at the end.
// A circle completes only when PayPal has confirmed every payout. Called by the worker on every tick.
import type { PrismaClient } from "@prisma/client";
import { circleNow, demoSecondsPerDay } from "@/domain/clock";
import { loadCircle } from "./gate-context";
import { openCycle } from "./cycles";
import { runCaptures, runDefaultSteps, runPreauthWindow } from "./guardian-jobs";
import { closeAuction, collectAgentBids } from "./auction";
import { refundDeposit } from "./settlement";
import { confirmPayouts, payoutOwedAccount } from "./payout-watch";
import { loadBalances } from "./ledger-store";
import { notice } from "./notices";

const DAY = 86_400_000;
// Sealed bids stay open for 2 circle days, and at least this many real seconds on a demo clock (so people can watch).
const AUCTION_MIN_REAL_SECONDS = Number(process.env.AUCTION_MIN_SECONDS ?? 20);

export type TickResult = "complete" | "opened" | "collecting" | "waiting" | "auction" | "settled" | "payouts_pending" | "payout_failed" | string;

export async function tickCircle(db: PrismaClient, circleId: string, at: Date, log: (m: string) => void = (m) => console.log(`[runner] ${m}`)): Promise<TickResult> {
  const { circle, body } = await loadCircle(db, circleId);
  if (circle.status === "complete") return "complete";
  if (circle.mode === "simulated") return "simulated";
  if (circle.status === "attention") {
    await confirmPayouts(db, circleId, log);
    const bal = await loadBalances(db, circleId);
    const owed = circle.members.some((m) => (bal.get(payoutOwedAccount(m.id)) ?? 0) !== 0);
    const pending = await db.payoutBatch.count({ where: { circleId, status: "pending" } });
    if (owed || pending) return "attention";
    await db.circle.update({ where: { id: circleId }, data: { status: "complete" } });
    await notice(db, { circleId, kind: "info", text: "Circle complete. The held payout was paid and confirmed by PayPal." });
    log("circle complete after a payout retry");
    return "complete";
  }
  // Circles from the Stage 2-3 scripts have no default steps or lead days; leave them alone.
  if (!body.defaultSteps || !body.preauthLeadDays) return "legacy";
  // Demo clocks pause while nothing runs them: after a gap (worker down, or not started yet) the clock resumes
  // where it stopped instead of jumping ahead.
  if (circle.secondsPerDay && circle.clockStartedAt) {
    const nowMs = Date.now();
    const gap = nowMs - (circle.lastTickAt ?? circle.clockStartedAt).getTime();
    const resumed = gap > 15_000 ? new Date(circle.clockStartedAt.getTime() + gap) : circle.clockStartedAt;
    await db.circle.update({ where: { id: circleId }, data: { lastTickAt: new Date(nowMs), clockStartedAt: resumed } });
    circle.clockStartedAt = resumed;
  }
  at = circleNow(circle, at);

  await confirmPayouts(db, circleId, log);

  const open = circle.cycles.find((c) => c.state !== "closed");
  if (!open) {
    for (const m of circle.members.filter((x) => x.depositCents > 0)) {
      const r = await refundDeposit(db, circleId, m.id);
      log(`deposit refund ${m.displayName}: ${r.refunded ? r.payoutBatchId : r.reasons?.join("; ")}`);
    }
    const final = await confirmPayouts(db, circleId, log);
    if (final.pending > 0) return "payouts_pending";
    if (final.failed > 0) {
      await db.circle.update({ where: { id: circleId }, data: { status: "attention" } });
      await notice(db, { circleId, kind: "info", text: "Every cycle has settled, but PayPal could not complete one or more payouts. The money is held for those members until it can be paid." });
      log("circle needs attention: a payout failed");
      return "payout_failed";
    }
    await db.circle.update({ where: { id: circleId }, data: { status: "complete" } });
    await notice(db, { circleId, kind: "info", text: "Circle complete. Every payout and deposit refund was confirmed by PayPal." });
    log("circle complete: every payout confirmed by PayPal");
    return "complete";
  }

  switch (open.state) {
    case "pending":
      await openCycle(db, circleId, open.number, log, at);
      log(`cycle ${open.number} open for contributions`);
      return "opened";

    case "collecting": {
      await runPreauthWindow(db, circleId, open, body, at, log);
      await runCaptures(db, circleId, open, at, log);
      await runDefaultSteps(db, circleId, open, body, at, log);
      const contribs = await db.contribution.findMany({ where: { circleId, cycleNumber: open.number } });
      if (contribs.some((c) => c.status === "shortfall")) return "waiting"; // member vote needed
      const resolved = contribs.length === circle.members.length && contribs.every((c) => c.status === "paid" || c.status === "covered");
      if (resolved && at >= open.dueAt) {
        await db.cycle.update({ where: { id: open.id }, data: { state: "auction", auctionOpenedAt: at } });
        await notice(db, { circleId, cycleNumber: open.number, kind: "auction", text: `Cycle ${open.number}: the pot is complete. Sealed bids are open.` });
        log(`cycle ${open.number}: pot complete, auction open`);
        return "auction";
      }
      return "collecting";
    }

    case "auction": {
      await collectAgentBids(db, circleId, open.number);
      const spd = circle.secondsPerDay ?? demoSecondsPerDay();
      const windowMs = spd > 0 ? Math.max(2 * DAY, (AUCTION_MIN_REAL_SECONDS / spd) * DAY) : 2 * DAY;
      if (open.auctionOpenedAt && at.getTime() < open.auctionOpenedAt.getTime() + windowMs) return "auction";
      const r = await closeAuction(db, circleId, open.number);
      const name = circle.members.find((m) => m.id === r.winnerId)?.displayName;
      log(r.result.settled ? `cycle ${open.number}: ${name} wins, discount ${r.discount}, batch ${r.result.payoutBatchId}` : `cycle ${open.number}: not settled: ${r.result.reasons.join("; ")}`);
      return "settled";
    }

    default:
      return open.state;
  }
}

export async function tickAll(db: PrismaClient, at: Date, log?: (m: string) => void) {
  const circles = await db.circle.findMany({
    where: { status: { in: ["active", "attention"] }, mode: "live" },
    select: { id: true, charters: { where: { frozen: true }, select: { id: true }, take: 1 } },
  });
  for (const c of circles) {
    if (c.charters.length === 0) continue; // not approved yet
    try {
      await tickCircle(db, c.id, at, log);
    } catch (err) {
      console.error(`[runner] circle ${c.id}:`, (err as Error).message);
    }
  }
}
