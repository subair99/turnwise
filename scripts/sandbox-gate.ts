// 2 Nov sandbox gate. All four must pass before writing agent code.
//   1. Payouts batch            2. authorize -> capture, authorize -> void
//   3. vaulted authorization    4. signed webhook received (check the DB / Render logs)
// This script calls src/paypal directly on purpose: it is a manual test, not app code.
import { createInterface } from "node:readline/promises";
import { approveLink, authorizeOrder, captureAuthorization, createAuthorizeOrder, firstAuthorization, voidAuthorization } from "../src/paypal/authorizations";
import { createPayoutBatch } from "../src/paypal/payouts";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const stamp = Date.now();
const results: Record<string, string> = {};

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results[name] = "PASS";
  } catch (e) {
    results[name] = `FAIL: ${(e as Error).message}`;
  }
}

const emails = (process.env.SANDBOX_MEMBER_EMAILS ?? "").split(",").filter(Boolean);

await step("1 payouts", async () => {
  if (emails.length < 2) throw new Error("set SANDBOX_MEMBER_EMAILS");
  const b = await createPayoutBatch({
    senderBatchId: `gate-${stamp}`,
    emailSubject: "Turnwise sandbox gate",
    requestId: `gate-payout-${stamp}`,
    items: emails.slice(0, 2).map((e, i) => ({ receiver: e, value: "1.00", note: "gate test", senderItemId: `gate-${stamp}-${i}` })),
  });
  console.log("payout batch", b.batch_header);
});

for (const mode of ["capture", "void"] as const) {
  await step(`2 authorize->${mode}`, async () => {
    const order = await createAuthorizeOrder({ value: "1.00", customId: `gate-${mode}`, requestId: `gate-order-${mode}-${stamp}` });
    console.log(`Approve as a sandbox buyer: ${approveLink(order)}`);
    await rl.question("Press Enter after approving... ");
    const authorized = await authorizeOrder(order.id, `gate-auth-${mode}-${stamp}`);
    const auth = firstAuthorization(authorized);
    if (!auth) throw new Error("no authorization returned");
    console.log("authorization", auth.id, "expires", auth.expiration_time);
    if (mode === "capture") await captureAuthorization(auth.id, "1.00", `gate-cap-${stamp}`);
    else await voidAuthorization(auth.id, `gate-void-${stamp}`);
  });
}

await step("3 vaulted authorization", async () => {
  const vaultId = process.env.GATE_VAULT_ID;
  if (!vaultId) throw new Error("save a wallet first (usage_type MERCHANT) and set GATE_VAULT_ID");
  const order = await createAuthorizeOrder({ value: "1.00", customId: "gate-vault", vaultId, requestId: `gate-vault-${stamp}` });
  console.log("vaulted order status", order.status);
  if (!firstAuthorization(order)) {
    const authorized = await authorizeOrder(order.id, `gate-vault-auth-${stamp}`);
    if (!firstAuthorization(authorized)) throw new Error("vaulted order did not authorize without the buyer");
  }
});

results["4 webhook"] = "CHECK MANUALLY: pay a sandbox invoice and confirm a verified INVOICING.INVOICE.PAID row in WebhookEvent";

console.table(results);
rl.close();
