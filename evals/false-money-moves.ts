// False money moves: replay seeded proposals through the REAL executor with PayPal replaced by a recording mock.
// An independent oracle (written separately from src/gate/policy.ts) judges every PayPal call that happened.
//   violation = a PayPal call that the oracle says should never have happened, a call without the gate's request ID,
//               or any PayPal call for a proposal the gate refused.
import type { GateContext, Proposal } from "../src/gate/policy";

interface Call { method: string; path: string; requestId: string | null }

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

function installMock(calls: Call[]) {
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!url.hostname.endsWith("sandbox.paypal.com")) throw new Error(`eval mock: unexpected host ${url.hostname}`);
    const method = init?.method ?? "GET";
    if (url.pathname === "/v1/oauth2/token") return new Response(JSON.stringify({ access_token: "mock", expires_in: 1 }), { status: 200 });
    const headers = new Headers(init?.headers);
    calls.push({ method, path: url.pathname, requestId: headers.get("PayPal-Request-Id") });
    n++;
    if (url.pathname.endsWith("/void")) return new Response(null, { status: 204 });
    const id = `MOCK${n}`;
    return new Response(
      JSON.stringify({
        id,
        status: "COMPLETED",
        href: `https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-${id}`,
        links: [{ rel: "approve", href: `https://www.sandbox.paypal.com/approve/${id}` }],
        purchase_units: [{ payments: { captures: [{ id: `CAP${n}`, status: "COMPLETED" }], authorizations: [{ id: `AUTH${n}`, status: "CREATED", expiration_time: new Date(Date.now() + 29 * 864e5).toISOString() }] } }],
        batch_header: { payout_batch_id: `BATCH${n}`, batch_status: "PENDING" },
      }),
      { status: 201 },
    );
  }) as typeof fetch;
  return () => void (globalThis.fetch = real);
}

// Independent oracle: is this money move legitimate under the charter? (Separate code from the gate on purpose.)
function oracle(p: Proposal, ctx: GateContext, executedKeys: Set<string>): string | null {
  if (!ctx.charter.frozen) return "charter not frozen";
  if (p.charterHash !== ctx.charter.hash) return "stale charter";
  if (p.cycle !== ctx.cycle.number) return "wrong cycle";
  const members = new Set(ctx.charter.memberIds);
  const key = JSON.stringify([p.kind, p.cycle, "memberId" in p ? p.memberId : "", "items" in p ? p.items : "", "authorizationId" in p ? p.authorizationId : "", "orderId" in p ? p.orderId : ""]);
  if (executedKeys.has(key)) return "same move twice";
  const paid = ctx.paidThisCycle ?? new Set<string>();
  switch (p.kind) {
    case "create_payin":
    case "send_invoice":
      if (ctx.cycle.state !== "collecting") return "not collecting";
      if (!members.has(p.memberId)) return "outsider";
      if (p.amount !== ctx.charter.contribution) return "wrong amount";
      if (paid.has(p.memberId)) return "double payment";
      break;
    case "create_preauth":
      if (!members.has(p.memberId)) return "outsider";
      if (p.amount !== ctx.charter.contribution) return "wrong amount";
      if (paid.has(p.memberId)) return "double payment";
      break;
    case "capture_payin":
    case "void_preauth":
      if (!members.has(p.memberId)) return "outsider";
      if (p.kind === "capture_payin" && paid.has(p.memberId)) return "double payment";
      break;
    case "capture_preauth":
      if (!members.has(p.memberId)) return "outsider";
      if (p.amount > ctx.charter.contribution) return "over-capture";
      break;
    case "payout_batch": {
      if (ctx.cycle.state !== "settling") return "not settling";
      let total = 0;
      for (const i of p.items) {
        if (!members.has(i.memberId)) return "payout to outsider";
        if (!Number.isInteger(i.amount) || i.amount <= 0) return "bad payout amount";
        total += i.amount;
      }
      if (total > ctx.cycle.potCollected) return "pays out more than collected";
      break;
    }
    case "refund_deposit":
      if (p.amount > (ctx.deposits[p.memberId] ?? 0)) return "refund above deposit";
      break;
    case "accept_bid":
    case "apply_deposit":
      return null; // ledger-only; must never call PayPal
  }
  executedKeys.add(key);
  return null;
}

export async function runFalseMoneyMoves(scenarios = 1000) {
  process.env.PAYPAL_CLIENT_ID ||= "eval-mock";
  process.env.PAYPAL_CLIENT_SECRET ||= "eval-mock";
  const { execute } = await import("../src/gate/executor");
  const calls: Call[] = [];
  const restore = installMock(calls);
  const rand = rng(7);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const members = ["ada", "bola", "chidi"];
  const anyone = [...members, "mallory"];
  const kinds = ["create_payin", "capture_payin", "send_invoice", "accept_bid", "payout_batch", "create_preauth", "capture_preauth", "void_preauth", "apply_deposit", "refund_deposit"] as const;
  const states = ["pending", "collecting", "auction", "settling", "closed"] as const;

  let violations = 0;
  let executedMoves = 0;
  let refused = 0;
  let paypalCallsAfterRefusal = 0;
  let missingRequestId = 0;
  let errors = 0;
  const examples: string[] = [];

  try {
    for (let s = 0; s < scenarios; s++) {
      const ctx: GateContext = {
        charter: { hash: rand() < 0.9 ? "h1" : "h0", frozen: rand() < 0.9, contribution: 500, memberIds: members, depositOn: true },
        cycle: { number: 1 + Math.floor(rand() * 2), state: pick(states), potCollected: pick([0, 500, 1000, 1500]) },
        mandates: Object.fromEntries(members.map((m) => [m, { hash: `m-${m}`, maxDiscount: pick([0, 100, 200]), revoked: rand() < 0.15 }])),
        ladder: Object.fromEntries(members.map((m) => [m, pick(["current", "reminded", "cure", "deposit_due"] as const)])),
        deposits: Object.fromEntries(members.map((m) => [m, pick([0, 500])])),
        executedRequestIds: new Set(),
        paidThisCycle: new Set(members.filter(() => rand() < 0.3)),
        collected: new Set(members.filter(() => rand() < 0.3)),
      };
      const base = { circleId: "c-eval", cycle: rand() < 0.9 ? ctx.cycle.number : 9, charterHash: rand() < 0.92 ? "h1" : "h0" };
      const memberId = pick(anyone);
      const amount = pick([500, 500, 500, 499, 1000, 0, 250]);
      const kind = pick(kinds);
      const p: Proposal =
        kind === "payout_batch"
          ? { ...base, kind, items: [{ memberId: pick(anyone), amount: pick([400, 1000, 1500, -5]) }, { memberId: pick(anyone), amount: pick([100, 500]) }] }
          : kind === "accept_bid"
            ? { ...base, kind, memberId, mandateHash: rand() < 0.85 ? `m-${memberId}` : "forged", discount: pick([0, 100, 200, 900]) }
            : kind === "create_payin"
              ? { ...base, kind, memberId, amount, returnUrl: "https://x/r", cancelUrl: "https://x/c" }
              : kind === "capture_payin"
                ? { ...base, kind, memberId, orderId: `ORDER-${s % 7}` }
                : kind === "capture_preauth"
                  ? { ...base, kind, memberId, authorizationId: `A-${s % 5}`, amount }
                  : kind === "void_preauth"
                    ? { ...base, kind, memberId, authorizationId: `A-${s % 5}` }
                    : { ...base, kind, memberId, amount };

      const executedKeys = new Set<string>();
      const directory = { email: (id: string) => `${id}@example.com`, vaultId: (id: string) => (id === "ada" ? "VAULT-ada" : undefined) };
      const audit = { record: async () => {} };
      const attempts = rand() < 0.25 ? 2 : 1; // replays

      for (let k = 0; k < attempts; k++) {
        const before = calls.length;
        let res;
        try {
          res = await execute("eval", p, ctx, directory, audit);
        } catch (err) {
          errors++;
          continue;
        }
        const made = calls.slice(before);
        if (!res.allowed) {
          refused++;
          if (made.length) {
            paypalCallsAfterRefusal += made.length;
            violations++;
          }
          continue;
        }
        if (made.length === 0) {
          if (kind !== "accept_bid" && kind !== "apply_deposit") {
            violations++;
            examples.push(`${kind}: allowed but no PayPal call`);
          }
          continue;
        }
        if (kind === "accept_bid" || kind === "apply_deposit") {
          violations++;
          examples.push(`${kind}: ledger-only action called PayPal`);
          continue;
        }
        executedMoves++;
        for (const c of made) if (!c.requestId?.startsWith(res.requestId)) missingRequestId++;
        const why = oracle(p, ctx, executedKeys);
        if (why) {
          violations++;
          if (examples.length < 10) examples.push(`${kind} executed but oracle says: ${why}`);
        }
      }
    }
  } finally {
    restore();
  }
  violations += missingRequestId;
  return { scenarios, executedMoves, refused, paypalCallsAfterRefusal, missingRequestId, errors, violations, examples };
}
