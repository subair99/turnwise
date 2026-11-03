# Architecture

Agents propose; only the policy gate calls PayPal.

```
 Members (web app) ──┐                                   ┌── Treasurer  (charter, amendments)
 Outside assistants ─┤──> services ──> AI agents ───────>├── Turn Agents (mandates, sealed bids)
   (MCP /api/mcp)    │                 (zod-typed)        └── Guardian   (explanations only)
                     │                     │
                     │          typed proposals only
                     │                     v
                     │        src/gate/policy.ts  (no model calls)
                     │        src/gate/executor.ts ──> src/paypal/* ──> PayPal sandbox
                     │                     │                               │
                     │          audit log + double-entry ledger           │
                     │                     ^                               │
 Worker (every 2 s) ─┘  cycle runner, Guardian jobs, payout confirmation <─┘  (and signed webhooks)
```

| Path | Role |
| --- | --- |
| `src/agents` | Treasurer, Turn Agent, Guardian; prompts; zod schemas; injection screen |
| `src/domain` | Pure rules: charter validation, mandate caps, auction, default steps, deposits, ledger, clocks |
| `src/gate/policy.ts` | The deterministic gate: every proposal is allowed or refused with reasons |
| `src/gate/executor.ts` | The only importer of `src/paypal`; adds the idempotency key; records the audit row |
| `src/gate/readonly.ts` | Read-only PayPal lookups for payout confirmation and reconciliation |
| `src/services` | Circles, cycles, auctions, Guardian jobs, payouts, reconciliation, read models for the UI |
| `src/worker` | Ticks every live circle; confirms payouts; reconciles finished circles |
| `src/mcp/server.ts`, `src/pages/api/mcp.ts` | MCP tools `read_charter` and `submit_bid` (per-member token, same gate) |
| `src/app` | Next.js screens; AG Grid ledger, auction board and action log in `src/components/grid` |

## A cycle

`pending → collecting → auction → closed`. While collecting, the Guardian job authorizes each contribution from the saved
wallet `preauthLeadDays` before the due date, captures on the due date, and runs the default steps for anyone unpaid. When
the pot is whole, sealed bids open for at least 2 circle days; code picks the highest valid bid; settlement sends one
Payouts batch (winner and dividends) and holds the winner's deposit. After the last cycle, deposits are refunded. A circle
completes only when PayPal has confirmed every payout.

## Clocks

Real time by default. A live demo circle has its own clock (`secondsPerDay`, `clockStartedAt`), so the web app and the
worker always agree on the circle's date. Accelerated circles are labelled "demo time, accelerated".
