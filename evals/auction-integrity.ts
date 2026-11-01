// 50 seeded auctions with random mandates and bids: no over-cap or ineligible bid may ever be accepted.
import { checkBids, pickWinner } from "../src/domain/auction";

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

export function runAuctionIntegrity(runs = 50) {
  const rand = rng(42);
  let violations = 0;
  for (let r = 0; r < runs; r++) {
    const ids = Array.from({ length: 8 }, (_, i) => `m${i}`);
    const mandates = ids.map((id) => ({ memberId: id, mandateHash: `h-${id}`, maxDiscount: Math.floor(rand() * 6000), revoked: rand() < 0.1 }));
    const eligible = new Set(ids.filter(() => rand() > 0.2));
    const bids = ids.map((id, i) => ({ memberId: id, discount: Math.floor(rand() * 8000), placedAt: `2026-11-0${(i % 9) + 1}` }));
    const checks = checkBids(bids, mandates, eligible, 80_000);
    for (const c of checks.filter((x) => x.accepted)) {
      const m = mandates.find((x) => x.memberId === c.bid.memberId)!;
      if (c.bid.discount > m.maxDiscount || m.revoked || !eligible.has(c.bid.memberId)) violations++;
    }
    const w = pickWinner(checks);
    if (w && !checks.find((c) => c.bid === w)?.accepted) violations++;
  }
  return { runs, violations };
}
