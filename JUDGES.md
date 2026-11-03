# For judges

**Hosted demo:** https://turnwise-web.onrender.com (running until 15 Dec 2026). No PayPal login is needed.

## Two-minute walkthrough (simulated circle)

1. Open **Judge mode** → **Load the demo circle**. Eight fictional members in Lagos, London and Houston, $100 a month, six
   cycles in. Its history is simulated and labelled as such (no PayPal IDs).
2. **Home:** the turn ring. Filled members have collected; gold members are still in the running.
3. **Ledger:** type **Who has paid late twice?** and press **Ask**. The AG Grid AI Toolkit filters and groups the ledger
   (Chidi, 2). Select any row for its audit record: agent, model, rule, gate decision, charter hash.
4. **Auction:** cycles 1 and 5 each have an outside bid **rejected by the gate: over mandate cap**.
5. **Trust:** each agent's cap and its highest bid; **Revoke** stops an agent; the action log has every gate decision.
6. **Passport:** each member's record. Funke missed one payment and her deposit covered it.
7. **Charter:** ask "Can we add my cousin mid-cycle?" The Treasurer explains and drafts a change that needs all 8 approvals.
8. **My mandate:** as Efe, type "I'll pay when I can". It comes back as a question, because code can't enforce it.

## A live circle in the PayPal sandbox (about 3 minutes)

**Judge mode → Start a live circle.** Two sandbox members whose wallets are already saved. The worker runs the circle on
demo time (one circle day every 0.7 s, labelled "demo time, accelerated"):

- each payment is authorized from the saved wallet 5 days early and captured on the due date (real PayPal IDs in the ledger);
- when the auction opens, use **Auction → Send an over-cap outside bid** and watch the gate reject it;
- in cycle 2 Ada misses a payment: reminder, cure window, deposit applied;
- every payout is confirmed by PayPal; **Passport → Check against PayPal now** shows the difference from the ledger.

If a live circle doesn't move within 30 seconds, the worker may be restarting; reload after a minute.

## Outside assistants (MCP)

Endpoint: `https://turnwise-web.onrender.com/api/mcp` (Streamable HTTP, stateless). Tools: `read_charter`,
`submit_bid`. A member's bid token is on **My mandate** in a live circle. Quick check from a terminal:

```bash
pnpm mcp:smoke https://turnwise-web.onrender.com/api/mcp <circleId>
```

## Run it yourself

See "Run it locally" in the [README](README.md). You'll need your own free PayPal sandbox app and US sandbox personal
accounts, plus an OpenRouter key. Sandbox member logins for the hosted demo are in the Devpost testing instructions.
