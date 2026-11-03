import { describe, expect, it } from "vitest";
import { applyChanges, validateCharter } from "@/domain/charter";

const good = { contributionCents: 500, cadence: "monthly" as const, members: 2, turnMode: "auction" as const, depositOn: true, graceDays: 3, cureHours: 48, preauthLeadDays: 5, voteQuorum: 0.5 };

describe("charter validation", () => {
  it("accepts a sensible charter", () => {
    expect(validateCharter(good).problems).toEqual([]);
  });
  it("rejects rules that don't fit PayPal's 29-day authorization", () => {
    expect(validateCharter({ ...good, preauthLeadDays: 10, graceDays: 14, cureHours: 168 }).problems.join(" ")).toMatch(/29-day/);
  });
  it("rejects a one-person circle and fractional cents", () => {
    const p = validateCharter({ ...good, members: 1, contributionCents: 12.5 }).problems;
    expect(p.length).toBeGreaterThanOrEqual(2);
  });
  it("applies amendment changes", () => {
    const { body } = validateCharter(good);
    expect(applyChanges(body, [{ field: "members", newValue: "3" }, { field: "depositOn", newValue: "no" }])).toMatchObject({ members: 3, depositOn: false });
  });
});
