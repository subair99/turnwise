// After a circle completes, compare its ledger with PayPal once and record the result in the audit log.
import { db } from "../../lib/db";
import { reconcileCircle } from "../../services/reconcile";

const done = new Set<string>();
let lastRun = 0;

export async function runReconcileJob(_now: Date): Promise<void> {
  if (Date.now() - lastRun < 60_000) return; // real time, at most once a minute
  lastRun = Date.now();
  const since = new Date(Date.now() - 2 * 86_400_000);
  const circles = await db.circle.findMany({ where: { status: "complete", createdAt: { gte: since } }, select: { id: true } });
  const next = circles.find((c) => !done.has(c.id));
  if (!next) return;
  done.add(next.id);
  const r = await reconcileCircle(db, next.id);
  await db.auditLog.create({
    data: {
      circleId: next.id,
      agent: "reconciler",
      proposal: { kind: "reconcile", checked: r.checked, unverified: r.unverified, driftCents: r.driftCents },
      allowed: true,
      reasons: r.rows.filter((x) => x.driftCents !== 0).map((x) => `${x.entry}: ledger ${x.ledgerCents} vs PayPal ${x.paypalCents ?? "?"}`),
    },
  });
  console.log(`[reconcile] circle ${next.id}: ${r.checked} PayPal objects checked, drift ${r.driftCents} cents`);
}
