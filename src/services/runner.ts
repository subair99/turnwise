// Moves each circle forward: pending -> collecting -> auction -> closed; refunds deposits at the end.
// Called by the worker on every tick (real time, or demo time when DEMO_SECONDS_PER_DAY is set).
import type { PrismaClient } from "@prisma/client";
import { loadCircle } from "./gate-context";
import { openCycle } from "./cycles";
import { runCaptures, runDefaultSteps, runPreauthWindow } from "./guardian-jobs";
import { closeAuction, collectAgentBids } from "./auction";
import { refundDeposit, setCycleState } from "./settlement";
import { notice } from "./notices";

export type TickResult = "complete" | "opened" | "collecting" | "waiting" | "auction" | "settled" | string;

export async function tickCircle(db: PrismaClient, circleId: string, at: Date, log: (m: string) => void = (m) => console.log(`[runner] ${m}`)): Promise<TickResult> {
  const { circle, body } = await loadCircle(db, circleId);
  if (circle.status === "complete") return "complete";
  // Circles from the Stage 2-3 scripts have no default steps or lead days; leave them alone.
  if (!body.defaultSteps || !body.preauthLeadDays) return "legacy";

  const open = circle.cycles.find((c) => c.state !== "closed");
  if (!open) {
    for (const m of circle.members.filter((x) => x.depositCents > 0)) {
      const r = await refundDeposit(db, circleId, m.id);
      log(`deposit refund ${m.displayName}: ${r.refunded ? r.payoutBatchId : r.reasons?.join("; ")}`);
    }
    await db.circle.update({ where: { id: circleId }, data: { status: "complete" } });
    await notice(db, { circleId, kind: "info", text: "Circle complete. Deposits returned to members who finished." });
    log("circle complete");
    return "complete";
  }

  switch (open.state) {
    case "pending":
      await openCycle(db, circleId, open.number, log);
      log(`cycle ${open.number} open for contributions (due ${open.dueAt.toISOString().slice(0, 10)})`);
      return "opened";

    case "collecting": {
      await runPreauthWindow(db, circleId, open, body, at, log);
      await runCaptures(db, circleId, open, at, log);
      await runDefaultSteps(db, circleId, open, body, at, log);
      const contribs = await db.contribution.findMany({ where: { circleId, cycleNumber: open.number } });
      if (contribs.some((c) => c.status === "shortfall")) return "waiting"; // member vote needed
      const resolved = contribs.length === circle.members.length && contribs.every((c) => c.status === "paid" || c.status === "covered");
      if (resolved && at >= open.dueAt) {
        await setCycleState(db, circleId, open.number, "auction");
        log(`cycle ${open.number}: pot complete, auction open`);
        return "auction";
      }
      return "collecting";
    }

    case "auction": {
      await collectAgentBids(db, circleId, open.number);
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
  const circles = await db.circle.findMany({ where: { status: "active" }, select: { id: true, charters: { where: { frozen: true }, select: { id: true }, take: 1 } } });
  for (const c of circles) {
    if (c.charters.length === 0) continue; // not approved yet
    try {
      await tickCircle(db, c.id, at, log);
    } catch (err) {
      console.error(`[runner] circle ${c.id}:`, (err as Error).message);
    }
  }
}
