import { describe, expect, it } from "vitest";
import { evaluate, type GateContext } from "@/gate/policy";

const ctx: GateContext = {
  charter: { hash: "h", frozen: true, contribution: 500, memberIds: ["ada", "bola"], depositOn: true },
  cycle: { number: 2, state: "closed", potCollected: 0 },
  mandates: {},
  ladder: {},
  deposits: {},
  executedRequestIds: new Set(),
  owed: { ada: 500 },
};
const base = { circleId: "c", cycle: 2, charterHash: "h", kind: "repay_owed" as const };

describe("gate: sending a held payout again (stage 6)", () => {
  it("allows paying exactly what is owed", () => {
    expect(evaluate({ ...base, memberId: "ada", amount: 500, attempt: 1 }, ctx).allowed).toBe(true);
  });
  it("refuses more than is owed, or to someone owed nothing", () => {
    expect(evaluate({ ...base, memberId: "ada", amount: 501, attempt: 1 }, ctx).reasons).toContain("more than is owed to the member");
    expect(evaluate({ ...base, memberId: "bola", amount: 100, attempt: 1 }, ctx).allowed).toBe(false);
  });
  it("refuses a non-member and replays of the same attempt", () => {
    expect(evaluate({ ...base, memberId: "mallory", amount: 100, attempt: 1 }, ctx).reasons).toContain("not a member");
    const d = evaluate({ ...base, memberId: "ada", amount: 500, attempt: 1 }, ctx);
    const replay = evaluate({ ...base, memberId: "ada", amount: 500, attempt: 1 }, { ...ctx, executedRequestIds: new Set([d.requestId]) });
    expect(replay.reasons).toContain("already executed (idempotency)");
    expect(evaluate({ ...base, memberId: "ada", amount: 500, attempt: 2 }, { ...ctx, executedRequestIds: new Set([d.requestId]) }).allowed).toBe(true);
  });
});
