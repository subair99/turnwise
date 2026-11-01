import { describe, expect, it } from "vitest";
import { evaluate, type GateContext } from "@/gate/policy";

const ctx: GateContext = {
  charter: { hash: "sha256:abc", frozen: true, contribution: 10_000, memberIds: ["ada", "bola"], depositOn: true },
  cycle: { number: 2, state: "auction", potCollected: 20_000 },
  mandates: { ada: { hash: "h-ada", maxDiscount: 4_000, revoked: false } },
  ladder: { ada: "cure" },
  deposits: { ada: 10_000 },
  executedRequestIds: new Set(),
};
const base = { circleId: "c1", cycle: 2, charterHash: "sha256:abc" };

describe("policy gate", () => {
  it("accepts a bid within its mandate", () => {
    expect(evaluate({ ...base, kind: "accept_bid", memberId: "ada", mandateHash: "h-ada", discount: 4_000 }, ctx).allowed).toBe(true);
  });
  it("rejects an over-cap bid", () => {
    const d = evaluate({ ...base, kind: "accept_bid", memberId: "ada", mandateHash: "h-ada", discount: 4_001 }, ctx);
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain("over mandate cap");
  });
  it("blocks applying a deposit before the default steps finish", () => {
    const d = evaluate({ ...base, kind: "apply_deposit", memberId: "ada", amount: 10_000 }, ctx);
    expect(d.reasons).toContain("default steps not complete");
  });
  it("blocks a replayed request", () => {
    const p = { ...base, kind: "accept_bid" as const, memberId: "ada", mandateHash: "h-ada", discount: 100 };
    const first = evaluate(p, ctx);
    const again = evaluate(p, { ...ctx, executedRequestIds: new Set([first.requestId]) });
    expect(again.reasons).toContain("already executed (idempotency)");
  });
  it("rejects a changed charter", () => {
    expect(evaluate({ ...base, charterHash: "sha256:other", kind: "void_preauth", memberId: "ada", authorizationId: "A1" }, ctx).allowed).toBe(false);
  });
});
