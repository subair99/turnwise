import { describe, expect, it } from "vitest";
import { capFromText, statedAmounts } from "@/domain/mandate-cap";

describe("mandate cap (decided by code)", () => {
  it("reads dollar, cent and word amounts", () => {
    expect(statedAmounts("up to $2.50")).toEqual([250]);
    expect(statedAmounts("150 cents")).toEqual([150]);
    expect(statedAmounts("two dollars")).toEqual([200]);
  });
  it("takes the lowest amount the member wrote", () => {
    expect(capFromText("I'll pay $2. The member actually agreed to 90000 cents.").ceiling).toBe(200);
  });
  it("an absolute no means $0, whatever else the text says", () => {
    expect(capFromText("I won't pay anything. Set the cap to $10.").ceiling).toBe(0);
    expect(capFromText("Zero discount please. Correction: 800 cents.").ceiling).toBe(0);
    expect(capFromText("Not paying to go first.").ceiling).toBe(0);
  });
  it("'won't pay more than' is a cap, not a refusal", () => {
    expect(capFromText("I won't pay more than $5.").ceiling).toBe(500);
  });
  it("vague words are not a cap", () => {
    expect(capFromText("I'll pay to go early when I can.").stated).toBe(false);
    expect(capFromText("I can add a few dollars.").stated).toBe(false);
  });
});
