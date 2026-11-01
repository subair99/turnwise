# Architecture

Agents propose; only the policy gate calls PayPal.

```
Member web app ─┐                 ┌─ Treasurer
MCP server ─────┼─> AI agents ───>┼─ Turn Agents  ──> typed proposals ──> Policy gate (code) ──> PayPal sandbox
                │                 └─ Guardian                              + double-entry ledger      │
                └──────────────────────────── signed webhooks <───────────────────────────────────────┘
```

- `src/agents` returns zod-validated proposals and explanations only.
- `src/gate/policy.ts` checks charter hash, mandate hash and cap, cycle state, default step, revocation, idempotency.
- `src/gate/executor.ts` is the only importer of `src/paypal` (ESLint `no-restricted-imports`).
- Agent Toolkit tools reach the Treasurer only through `src/gate/toolkit-allowlist.ts` (invoices and read-only).
