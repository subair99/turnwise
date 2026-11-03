import { describe, expect, it } from "vitest";
import { evaluate, type GateContext } from "@/gate/policy";

const ctx: GateContext = {
  charter: { hash: "h", frozen: true, contribution: 500, memberIds: ["ada", "bola"], depositOn: true },
  cycle: { number: 2, state: "auction", potCollected: 1000 },
  mandates: { ada: { hash: "ha", maxDiscount: 200, revoked: false }, bola: { hash: "hb", maxDiscount: 0, revoked: false } },
  ladder: { ada: "deposit_due" },
  deposits: { ada: 500 },
  executedRequestIds: new Set(),
  collected: new Set(["ada"]),
};
const base = { circleId: "c", cycle: 2, charterHash: "h" };

describe("gate: auction and deposits (stage 4)", () => {
  it("refuses a bid from a member who already collected", () => {
    expect(evaluate({ ...base, kind: "accept_bid", memberId: "ada", mandateHash: "ha", discount: 100 }, ctx).reasons).toContain("member has already collected");
  });
  it("refuses an over-cap bid from an outside assistant", () => {
    expect(evaluate({ ...base, kind: "accept_bid", memberId: "bola", mandateHash: "hb", discount: 900 }, ctx).reasons).toContain("over mandate cap");
  });
  it("allows a bid within the mandate", () => {
    expect(evaluate({ ...base, kind: "accept_bid", memberId: "bola", mandateHash: "hb", discount: 0 }, ctx).allowed).toBe(true);
  });
  it("applies a deposit only once the default steps are done", () => {
    expect(evaluate({ ...base, kind: "apply_deposit", memberId: "ada", amount: 500 }, ctx).allowed).toBe(true);
    expect(evaluate({ ...base, kind: "apply_deposit", memberId: "ada", amount: 500 }, { ...ctx, ladder: { ada: "cure" } }).allowed).toBe(false);
  });
});
