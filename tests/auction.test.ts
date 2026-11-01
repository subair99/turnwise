import { describe, expect, it } from "vitest";
import { checkBids, pickWinner, settle } from "@/domain/auction";

const ids = ["ada", "bola", "chidi", "dami", "efe", "funke", "gbenga", "halima"];

describe("auction", () => {
  it("settles the worked example: $660 to Ada, $100 deposit, $40 split across 7", () => {
    const s = settle({ contribution: 10_000, memberIds: ids, winnerId: "ada", discount: 4_000, depositOn: true });
    expect(s.pot).toBe(80_000);
    expect(s.winnerPayout).toBe(66_000);
    expect(s.deposit).toBe(10_000);
    expect(s.dividends).toHaveLength(7);
    expect(s.dividends.reduce((t, d) => t + d.amount, 0)).toBe(4_000);
    expect(s.winnerPayout + s.deposit + s.discount).toBe(s.pot);
  });

  it("rejects an over-cap bid and picks the highest valid bid", () => {
    const mandates = ids.map((m) => ({ memberId: m, mandateHash: `h-${m}`, maxDiscount: 4_000, revoked: false }));
    const checks = checkBids(
      [
        { memberId: "ada", discount: 4_000, placedAt: "2026-11-01T10:00:00Z" },
        { memberId: "bola", discount: 6_000, placedAt: "2026-11-01T09:00:00Z" },
        { memberId: "chidi", discount: 2_500, placedAt: "2026-11-01T08:00:00Z" },
      ],
      mandates,
      new Set(ids),
      80_000,
    );
    expect(checks.find((c) => c.bid.memberId === "bola")).toMatchObject({ accepted: false, reason: "over mandate cap" });
    expect(pickWinner(checks)?.memberId).toBe("ada");
  });
});
