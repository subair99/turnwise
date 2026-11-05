// pnpm webhooks:check — read-only webhook diagnostics. IDs are masked; safe to screenshot.
import { db } from "../src/lib/db";
import { webhookDiagnostics } from "../src/gate/readonly";

const mask = (s: string | undefined) => (s ? `…${s.slice(-4)}` : "(not set)");
const configured = process.env.PAYPAL_WEBHOOK_ID;
const d = await webhookDiagnostics(3);

console.log(`App credentials: client ID ${mask(process.env.PAYPAL_CLIENT_ID)}`);
console.log(`PAYPAL_WEBHOOK_ID on this service: ${mask(configured)}`);
console.log(`\nWebhooks registered on this app: ${d.webhooks.length}`);
console.table(d.webhooks.map((w) => ({ id: mask(w.id), matchesEnv: w.id === configured, url: w.url, events: w.events.length })));
const match = d.webhooks.find((w) => w.id === configured);
if (!d.webhooks.length) console.log("→ No webhook on this app. Add one in the dashboard under THIS app's Sandbox Webhooks.");
else if (!match) console.log("→ PAYPAL_WEBHOOK_ID does not match any webhook on this app. Copy the ID of the webhook above into Render.");
else {
  if (!/turnwise-web\.onrender\.com\/api\/paypal\/webhooks$/.test(match.url)) console.log(`→ The matching webhook's URL looks wrong: ${match.url}`);
  console.log(`  Subscribed events: ${match.events.join(", ") || "(none)"}`);
}

console.log(`\nEvents PayPal generated for this app in the last 3 days: ${d.events.length}`);
console.table(d.events.slice(0, 10).map((e) => ({ type: e.event_type, at: e.create_time })));
if (!d.events.length) console.log("→ PayPal has generated no events yet. Run a live circle (Judge mode) and check again in a few minutes.");

const stored = await db.webhookEvent.count();
const recent = await db.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 5, select: { eventType: true, receivedAt: true, processed: true } });
console.log(`\nEvents Turnwise has stored (verified): ${stored}`);
if (recent.length) console.table(recent.map((e) => ({ type: e.eventType, at: e.receivedAt.toISOString().slice(0, 19), processed: e.processed })));

const base = process.env.PUBLIC_BASE_URL ?? "https://turnwise-web.onrender.com";
try {
  const r = await fetch(`${base}/api/paypal/webhooks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  console.log(`\nEndpoint probe: ${r.status} ${r.status === 400 ? "(reachable — 400 is expected for an empty test body)" : ""}`);
} catch (e) {
  console.log(`\nEndpoint probe failed: ${(e as Error).message}`);
}
await db.$disconnect();
