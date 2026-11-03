import { describe, expect, it } from "vitest";
import { evaluate, type GateContext } from "@/gate/policy";

const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  charter: { hash: "sha256:abc", frozen: true, contribution: 500, memberIds: ["ada", "bola"], depositOn: true },
  cycle: { number: 1, state: "collecting", potCollected: 0 },
  mandates: {},
  ladder: {},
  deposits: {},
  executedRequestIds: new Set(),
  paidThisCycle: new Set(),
  ...over,
});
const base = { circleId: "c1", cycle: 1, charterHash: "sha256:abc" };
const payin = { ...base, kind: "create_payin" as const, memberId: "ada", amount: 500, returnUrl: "r", cancelUrl: "c" };

describe("gate: pay-ins and invoices", () => {
  it("allows a pay-in of exactly one contribution while collecting", () => {
    expect(evaluate(payin, ctx()).allowed).toBe(true);
  });
  it("refuses a pay-in of the wrong amount", () => {
    expect(evaluate({ ...payin, amount: 600 }, ctx()).reasons).toContain("amount must equal one contribution");
  });
  it("refuses a second pay-in once paid", () => {
    expect(evaluate(payin, ctx({ paidThisCycle: new Set(["ada"]) })).reasons).toContain("already paid this cycle");
  });
  it("refuses pay-ins outside the collecting state", () => {
    expect(evaluate(payin, ctx({ cycle: { number: 1, state: "settling", potCollected: 1000 } })).reasons).toContain("cycle not collecting");
  });
  it("refuses an invoice to a non-member", () => {
    expect(evaluate({ ...base, kind: "send_invoice", memberId: "zed", amount: 500 }, ctx()).reasons).toContain("not a member");
  });
  it("refuses pre-authorizing a contribution already paid", () => {
    const d = evaluate({ ...base, kind: "create_preauth", memberId: "bola", amount: 500 }, ctx({ paidThisCycle: new Set(["bola"]) }));
    expect(d.reasons).toContain("already paid this cycle");
  });
  it("blocks a payout larger than the collected pot", () => {
    const d = evaluate(
      { ...base, kind: "payout_batch", items: [{ memberId: "ada", amount: 1500 }] },
      ctx({ cycle: { number: 1, state: "settling", potCollected: 1000 } }),
    );
    expect(d.reasons).toContain("payout exceeds collected pot");
  });
});
