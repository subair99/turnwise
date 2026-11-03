# Devpost draft (check every claim against the README before submitting)

**Tagline:** Your savings circle, without the collector.

**About**

Savings circles such as ajo, esusu, tandas and susus depend on one collector who can keep the pot, and on early
recipients who keep paying. Turnwise replaces the collector with PayPal and three AI agents working under a charter every
member approves. Each member's Turn Agent bids for an earlier payout within a mandate code can enforce, and the winning
discount is shared with everyone else through one PayPal Payouts batch. Outside assistants can bid through our MCP
endpoint. After someone collects, each of their later contributions is authorized from their saved PayPal wallet five days
early and captured on the due date. A refundable deposit covers anyone who walks away, used only after a reminder, grace
days and a window to pay that everyone agreed in advance.

The AI never moves money. Every PayPal call passes a deterministic policy gate, with idempotency keys, a double-entry
ledger, payouts confirmed with PayPal item by item, and reconciliation against PayPal's records. Our own reconciliation
caught a payout PayPal accepted and then denied; Turnwise now holds that money for the member and sends it again through
the gate. We publish our red-team and eval results, misses included.

**Built with:** PayPal Orders v2 (capture and authorize), Payments v2, Vault, Payouts, Invoicing v2, Webhooks, Agent
Toolkit (allow-listed); `openai/gpt-6-luna` via OpenRouter and the Vercel AI SDK; AG Grid Enterprise with the AI Toolkit;
Model Context Protocol; Next.js, Prisma, Postgres; Render. Sandbox prototype; custody and regulatory notes are in the README.

**Testing instructions (judges only):** hosted demo URL, Judge mode steps from JUDGES.md, and the sandbox member logins
(sandbox accounts only; no real money).

Before submitting, search all text for: "billion", "$500", "400 years", "cryptographic", "signed mandates",
"renewed each cycle", "Transaction Search", "JS SDK", "Disputes". Keep only what the README's capability matrix supports.
