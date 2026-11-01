# Turnwise

**Your savings circle, without the collector.**

Turnwise is an AI treasurer for rotating savings circles (ajo, esusu, tandas, susus) built on PayPal.
Member agents bid for turns within enforceable mandates; a deterministic policy gate executes every
money move. Sandbox prototype for the PayPal AI Hackathon.

> Independent hackathon project. Sandbox only. Not affiliated with or endorsed by PayPal.

## Demo
- Video (under 3 minutes): TODO YouTube link
- Hosted demo: TODO Render URL — click **Judge mode** to load a seeded circle
- Judge walkthrough and sandbox logins: see [JUDGES.md](JUDGES.md)

## 1. Potential impact — the problem
Savings circles fail in two documented ways: the collector keeps the pot, or an early recipient stops paying.
- Legit.ng (6 Aug 2026): a Lagos businesswoman lost ₦10 million in ajo savings — https://www.legit.ng/people/1723654-nigerian-businesswoman-cries-losing-n10-million-ajo-savings-meant-factory/
- NPR on US tandas — https://www.npr.org/blogs/codeswitch/2014/04/01/292580644/lending-circles-help-latinas-pay-bills-and-invest
- Zikoko, member accounts of failing ajo groups — https://www.zikoko.com/?p=260498

## 2. Innovation
- Sealed turn auctions run by each member's agent, within a mandate code can enforce
- Pre-authorized contributions: PayPal holds each payment in the member's own account until it's due
- Refundable deposit covers anyone who walks away, applied only after agreed default steps
- Outside assistants can join and bid through a public MCP endpoint

## 3. Technological implementation
### How Turnwise uses PayPal (capability matrix)
| Capability | Job | Status |
| --- | --- | --- |
| Agent Toolkit | Invoices, reminders, QR codes, transactions, disputes (allow-listed) | TODO |
| Invoicing API | One invoice per member per cycle | TODO |
| Orders v2 AUTHORIZE + Payments v2 | Pre-authorize 5 days early, capture on due date, void | TODO |
| Vault (usage_type MERCHANT) | Authorizations without the member present | TODO |
| Payouts API | Winner payout, dividends, deposit refunds | TODO |
| JS SDK v6 | Pay-in buttons and approvals | TODO |
| Webhooks | Signature-verified, de-duplicated | TODO |
| Transaction Search | Reconciliation and Turn Passport | TODO |
| Disputes | Flag chargebacks after collection | TODO |

Mark each row **Live sandbox** or **Simulated (reason)** after `pnpm sandbox:gate`.

### How Turnwise uses AI
- Treasurer: charter drafting, amendments, invoices, explanations
- Turn Agent: mandate extraction, sealed bids
- Guardian: pre-authorization schedule, default steps, chargeback flags
- AG Grid AI Toolkit: plain-language ledger queries
- Model: TODO exact model and version

### Safety: agents propose, the gate decides
Only `src/gate/executor.ts` may import `src/paypal` (enforced by ESLint). See [docs/architecture.md](docs/architecture.md).

### Eval scorecard
See [evals/RESULTS.md](evals/RESULTS.md) — real numbers, misses included.

## 4. Design
TODO screenshots from `docs/screenshots/`.

## 5. Custody and limits
See [docs/custody-and-compliance.md](docs/custody-and-compliance.md), including the 29-day PayPal authorization limit.

## Run it locally
```bash
pnpm install
cp .env.example .env          # sandbox credentials
docker compose up -d db
pnpm db:migrate && pnpm db:seed
pnpm dev                      # web app on :3000
pnpm worker                   # background jobs
pnpm mcp                      # MCP endpoint on :3001
```
Or everything at once: `docker compose up`.

## Built during the hackathon
Repository created on 1 Nov 2026; all commits fall inside the submission period.

## Tools used
TODO: exact model and version, PayPal Agent Toolkit, Vercel AI SDK, AG Grid Enterprise + AI Toolkit, Render.

## Licence
MIT
