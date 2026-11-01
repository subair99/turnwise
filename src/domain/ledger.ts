// Double-entry ledger. Every entry must balance; the sum of all postings is always zero.
import { type Cents } from "../lib/money";
import type { Settlement } from "./auction";

export interface Posting {
  account: string;
  debit: Cents;
  credit: Cents;
}

export interface Entry {
  description: string;
  postings: Posting[];
  paypalObjectId?: string;
  requestId?: string;
}

export const accounts = {
  cash: "cash:circle",
  pot: (cycle: number) => `pot:cycle-${cycle}`,
  member: (id: string) => `member:${id}`,
  deposit: (id: string) => `liability:deposit:${id}`,
};

export function assertBalanced(entry: Entry): void {
  const d = entry.postings.reduce((s, p) => s + p.debit, 0);
  const c = entry.postings.reduce((s, p) => s + p.credit, 0);
  if (d !== c) throw new Error(`Unbalanced entry "${entry.description}": debits ${d} != credits ${c}`);
}

// Positive balance = net debit.
export function balances(entries: Entry[]): Map<string, Cents> {
  const out = new Map<string, Cents>();
  for (const e of entries) {
    assertBalanced(e);
    for (const p of e.postings) out.set(p.account, (out.get(p.account) ?? 0) + p.debit - p.credit);
  }
  return out;
}

export function contributionEntry(memberId: string, cycle: number, amount: Cents, paypalId?: string): Entry {
  return {
    description: `Contribution from ${memberId}, cycle ${cycle}`,
    paypalObjectId: paypalId,
    postings: [
      { account: accounts.cash, debit: amount, credit: 0 },
      { account: accounts.pot(cycle), debit: 0, credit: amount },
    ],
  };
}

// Clears the cycle's pot: payouts leave the circle's cash; the deposit becomes a liability owed to the winner.
export function settlementEntry(cycle: number, s: Settlement, paypalBatchId?: string): Entry {
  const paidOut = s.winnerPayout + s.dividends.reduce((t, d) => t + d.amount, 0);
  const postings: Posting[] = [
    { account: accounts.pot(cycle), debit: s.pot, credit: 0 },
    { account: accounts.cash, debit: 0, credit: paidOut },
  ];
  if (s.deposit > 0) postings.push({ account: accounts.deposit(s.winnerId), debit: 0, credit: s.deposit });
  return { description: `Settlement of cycle ${cycle}`, paypalObjectId: paypalBatchId, postings };
}

export function depositAppliedEntry(memberId: string, cycle: number, amount: Cents): Entry {
  return {
    description: `Deposit of ${memberId} applied to cycle ${cycle}`,
    postings: [
      { account: accounts.deposit(memberId), debit: amount, credit: 0 },
      { account: accounts.pot(cycle), debit: 0, credit: amount },
    ],
  };
}

export function depositRefundEntry(memberId: string, amount: Cents, paypalId?: string): Entry {
  return {
    description: `Deposit refunded to ${memberId}`,
    paypalObjectId: paypalId,
    postings: [
      { account: accounts.deposit(memberId), debit: amount, credit: 0 },
      { account: accounts.cash, debit: 0, credit: amount },
    ],
  };
}
