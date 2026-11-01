import { describe, expect, it } from "vitest";
import { splitEvenly, toCents, toValue } from "@/lib/money";

describe("money", () => {
  it("parses and formats amounts", () => {
    expect(toCents("100")).toBe(10_000);
    expect(toCents("5.7")).toBe(570);
    expect(toValue(66_000)).toBe("660.00");
    expect(toValue(571)).toBe("5.71");
  });
  it("splits without losing a cent", () => {
    const parts = splitEvenly(4_000, 7);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(4_000);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });
  it("rejects bad input", () => {
    expect(() => toCents("1.234")).toThrow();
    expect(() => toValue(-1)).toThrow();
  });
});
