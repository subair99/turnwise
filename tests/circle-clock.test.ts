import { describe, expect, it } from "vitest";
import { circleNow } from "@/domain/clock";

describe("per-circle demo clock", () => {
  it("runs one circle day per secondsPerDay real seconds from clockStartedAt", () => {
    const started = new Date(Date.now() - 7_000); // 7 real seconds ago
    const t = circleNow({ secondsPerDay: 0.7, clockStartedAt: started });
    const days = (t.getTime() - started.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(9.5);
    expect(days).toBeLessThan(10.5);
  });
  it("falls back when the circle has no clock", () => {
    const f = new Date("2026-01-01T00:00:00Z");
    expect(circleNow({ secondsPerDay: null, clockStartedAt: null }, f)).toBe(f);
  });
});
