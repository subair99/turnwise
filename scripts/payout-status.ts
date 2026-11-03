// pnpm payout:status <payoutBatchId>  — what PayPal says happened to each item (read-only)
import { payoutBatchOutcome } from "../src/gate/readonly";

const id = process.argv[2];
if (!id) throw new Error("Usage: pnpm payout:status <payoutBatchId>");
const r = await payoutBatchOutcome(id);
console.log(`Batch ${id}: ${r.batchStatus}`);
console.table(r.items.map((i) => ({ item: i.index, status: i.status, amount: `$${(i.amountCents / 100).toFixed(2)}`, error: i.error ?? "" })));
