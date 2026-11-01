import { describe, expect, it } from "vitest";
import { ladderActions, ladderStep } from "@/domain/default-ladder";
import { applyDeposit } from "@/domain/deposits";

const due = new Date("2026-12-01T00:00:00Z");
const policy = { graceDays: 3, cureHours: 48 };
const at = (h: number) => new Date(due.getTime() + h * 3600_000);

describe("default steps", () => {
  it("moves through reminder, cure, deposit in order", () => {
    expect(ladderStep(due, at(-1), false, policy)).toBe("current");
    expect(ladderStep(due, at(1), false, policy)).toBe("reminded");
    expect(ladderStep(due, at(73), false, policy)).toBe("cure");
    expect(ladderStep(due, at(121), false, policy)).toBe("deposit_due");
    expect(ladderStep(due, at(500), true, policy)).toBe("resolved");
  });
  it("never skips an action when the worker is slow", () => {
    expect(ladderActions("current", "deposit_due")).toEqual(["send_reminder", "open_cure_window", "apply_deposit"]);
  });
  it("applies the deposit and reports any shortfall", () => {
    expect(applyDeposit(10_000, 10_000)).toEqual({ applied: 10_000, remaining: 0, shortfall: 0 });
    expect(applyDeposit(10_000, 15_000)).toEqual({ applied: 10_000, remaining: 0, shortfall: 5_000 });
  });
});
