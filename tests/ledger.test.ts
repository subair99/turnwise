import { describe, expect, it } from "vitest";
import { settle } from "@/domain/auction";
import { accounts, balances, contributionEntry, settlementEntry } from "@/domain/ledger";

describe("double-entry ledger", () => {
  it("clears the pot after settlement and records the deposit as a liability", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const entries = ids.map((m) => contributionEntry(m, 2, 10_000));
    const s = settle({ contribution: 10_000, memberIds: ids, winnerId: "a", discount: 4_000, depositOn: true });
    entries.push(settlementEntry(2, s));
    const b = balances(entries);
    expect(b.get(accounts.pot(2))).toBe(0);
    expect(b.get(accounts.deposit("a"))).toBe(-10_000);
    expect(b.get(accounts.cash)).toBe(10_000); // deposit still held in the circle account
    expect([...b.values()].reduce((x, y) => x + y, 0)).toBe(0);
  });
});
