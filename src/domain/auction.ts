import { type Cents, assertCents, splitEvenly } from "../lib/money";

export interface Bid {
  memberId: string;
  discount: Cents;
  placedAt: string; // ISO timestamp
}

export interface MandateCap {
  memberId: string;
  mandateHash: string;
  maxDiscount: Cents;
  revoked: boolean;
}

export interface BidCheck {
  bid: Bid;
  accepted: boolean;
  reason?: string;
}

// Deterministic gate check for every bid. The Auction Board shows these results.
export function checkBids(bids: Bid[], mandates: MandateCap[], eligible: Set<string>, pot: Cents): BidCheck[] {
  const byMember = new Map(mandates.map((m) => [m.memberId, m]));
  const seen = new Set<string>();
  return bids.map((bid) => {
    const mandate = byMember.get(bid.memberId);
    if (seen.has(bid.memberId)) return { bid, accepted: false, reason: "duplicate bid this cycle" };
    seen.add(bid.memberId);
    if (!eligible.has(bid.memberId)) return { bid, accepted: false, reason: "member has already collected" };
    if (!mandate) return { bid, accepted: false, reason: "no mandate" };
    if (mandate.revoked) return { bid, accepted: false, reason: "mandate revoked" };
    if (!Number.isInteger(bid.discount) || bid.discount < 0) return { bid, accepted: false, reason: "invalid amount" };
    if (bid.discount > mandate.maxDiscount) return { bid, accepted: false, reason: "over mandate cap" };
    if (bid.discount >= pot) return { bid, accepted: false, reason: "discount not below pot" };
    return { bid, accepted: true };
  });
}

// Highest accepted discount wins; ties go to the earliest bid, then member ID.
export function pickWinner(checks: BidCheck[]): Bid | null {
  const accepted = checks.filter((c) => c.accepted).map((c) => c.bid);
  if (accepted.length === 0) return null;
  return [...accepted].sort(
    (a, b) => b.discount - a.discount || a.placedAt.localeCompare(b.placedAt) || a.memberId.localeCompare(b.memberId),
  )[0]!;
}

export interface Settlement {
  winnerId: string;
  pot: Cents;
  discount: Cents;
  deposit: Cents;
  winnerPayout: Cents;
  dividends: { memberId: string; amount: Cents }[];
}

// Example: 8 members x $100, $40 discount, deposit on
//   pot 80,000 -> winner 66,000; deposit 10,000 held; dividends 4,000 split across 7 (572/571 cents)
export function settle(args: {
  contribution: Cents;
  memberIds: string[];
  winnerId: string;
  discount: Cents;
  depositOn: boolean;
}): Settlement {
  const { contribution, memberIds, winnerId, discount, depositOn } = args;
  assertCents(contribution);
  assertCents(discount);
  if (!memberIds.includes(winnerId)) throw new Error("Winner is not a member");
  const pot = contribution * memberIds.length;
  const deposit = depositOn ? contribution : 0;
  const winnerPayout = pot - discount - deposit;
  if (winnerPayout < 0) throw new Error("Discount and deposit exceed the pot");
  const others = memberIds.filter((m) => m !== winnerId).sort();
  const shares = others.length > 0 ? splitEvenly(discount, others.length) : [];
  return {
    winnerId,
    pot,
    discount,
    deposit,
    winnerPayout,
    dividends: others.map((memberId, i) => ({ memberId, amount: shares[i]! })),
  };
}
