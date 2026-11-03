// pnpm reconcile [circleId]  — ledger vs PayPal for a circle (default: the latest completed circle). Read-only.
import { db } from "../src/lib/db";
import { formatMoney } from "../src/lib/money";
import { reconcileCircle } from "../src/services/reconcile";

const id =
  process.argv[2] ??
  (await db.circle.findFirst({ where: { status: "complete", ledger: { some: { paypalObjectId: { not: null } } } }, orderBy: { createdAt: "desc" } }))?.id;
if (!id) throw new Error("No completed circle with PayPal activity found. Run `pnpm demo:circle` first.");
const r = await reconcileCircle(db, id);
console.table(r.rows.map((x) => ({ entry: x.entry, paypal: x.paypalId ?? "", status: x.status, ledger: formatMoney(x.ledgerCents), paypalAmount: x.paypalCents === null ? "?" : formatMoney(x.paypalCents), drift: formatMoney(x.driftCents) })));
console.log(`Circle ${id}: ${r.checked} PayPal objects checked, ${r.unverified} unverified, drift ${formatMoney(r.driftCents)}`);
await db.$disconnect();
process.exitCode = r.driftCents === 0 && r.unverified === 0 ? 0 : 1;
