// Sealed-bid turn auction. Agents (and outside assistants via MCP) bid; the gate checks each bid;
// code picks the winner; settlement pays out through PayPal.
import type { PrismaClient } from "@prisma/client";
import { checkBids, pickWinner, type Bid as DomainBid, type MandateCap } from "@/domain/auction";
import { proposeBid } from "@/agents/turn-agent";
import { now } from "@/domain/clock";
import { gateFor, latestMandates, loadCircle } from "./gate-context";
import { settleCycle } from "./settlement";
import { notice } from "./notices";

export async function submitBid(
  db: PrismaClient,
  circleId: string,
  cycleNumber: number,
  memberId: string,
  discountCents: number,
  source: "turn-agent" | "mcp",
  explanation?: string,
) {
  const mandate = (await latestMandates(db, [memberId])).get(memberId);
  const g = await gateFor(db, circleId, cycleNumber, source);
  const res = await g.run({
    kind: "accept_bid",
    circleId,
    cycle: cycleNumber,
    charterHash: g.charterHash,
    memberId,
    mandateHash: mandate?.hash ?? "none",
    discount: discountCents,
  });
  const cycle = await db.cycle.findUniqueOrThrow({ where: { circleId_number: { circleId, number: cycleNumber } } });
  const bid = await db.bid.create({
    data: {
      cycleId: cycle.id,
      memberId,
      discountCents,
      source,
      accepted: res.allowed,
      gateReason: res.reasons.join("; ") || null,
      explanation: explanation ?? null,
    },
  });
  return { accepted: res.allowed, reasons: res.reasons, bid };
}

export async function collectAgentBids(db: PrismaClient, circleId: string, cycleNumber: number) {
  const { circle, body } = await loadCircle(db, circleId);
  const cycle = circle.cycles.find((c) => c.number === cycleNumber)!;
  const already = await db.bid.count({ where: { cycleId: cycle.id, source: "turn-agent" } });
  if (already > 0) return;

  const eligible = circle.members.filter((m) => m.collectedCycle === null);
  const mandates = await latestMandates(db, eligible.map((m) => m.id));
  const cyclesLeft = circle.cycles.filter((c) => c.state !== "closed").length;
  for (const m of eligible) {
    const mandate = mandates.get(m.id);
    if (!mandate || mandate.revoked) continue;
    let discount = 0;
    let explanation = "No bid from the agent; joining at no discount.";
    try {
      const p = await proposeBid(mandate.body, {
        cycle: cycleNumber,
        potCents: body.contributionCents * circle.members.length,
        cyclesLeft,
        today: now().toISOString().slice(0, 10),
      });
      discount = p.discountCents;
      explanation = p.explanation;
    } catch (err) {
      explanation = `Agent unavailable (${(err as Error).message.slice(0, 80)}); bid 0.`;
    }
    await submitBid(db, circleId, cycleNumber, m.id, discount, "turn-agent", explanation);
  }
}

export async function closeAuction(db: PrismaClient, circleId: string, cycleNumber: number) {
  const { circle, body } = await loadCircle(db, circleId);
  const cycle = circle.cycles.find((c) => c.number === cycleNumber)!;
  const eligible = new Set(circle.members.filter((m) => m.collectedCycle === null).map((m) => m.id));
  const pot = body.contributionCents * circle.members.length;

  const rows = await db.bid.findMany({ where: { cycleId: cycle.id, accepted: true }, orderBy: { placedAt: "asc" } });
  const mandates = await latestMandates(db, [...eligible]);
  const caps: MandateCap[] = [...mandates.values()].map((m) => ({
    memberId: m.memberId,
    mandateHash: m.hash,
    maxDiscount: (m.body as { maxDiscountCents?: number }).maxDiscountCents ?? 0,
    revoked: m.revoked,
  }));
  const bids: DomainBid[] = rows.map((b) => ({ memberId: b.memberId, discount: b.discountCents, placedAt: b.placedAt.toISOString() }));
  const winnerBid = pickWinner(checkBids(bids, caps, eligible, pot));

  // No valid bid: the first eligible member takes the turn at no discount (fixed order).
  const winnerId = winnerBid?.memberId ?? circle.members.find((m) => eligible.has(m.id))?.id;
  if (!winnerId) throw new Error("No eligible member left to collect");
  const discount = winnerBid?.discount ?? 0;

  const result = await settleCycle(db, circleId, cycleNumber, winnerId, discount);
  if (result.settled) {
    const name = circle.members.find((m) => m.id === winnerId)?.displayName ?? winnerId;
    await notice(db, {
      circleId,
      cycleNumber,
      memberId: winnerId,
      kind: "payout",
      text: `${name} collects cycle ${cycleNumber}: $${(result.settlement.winnerPayout / 100).toFixed(2)}${result.settlement.deposit ? `, with $${(result.settlement.deposit / 100).toFixed(2)} held as a deposit` : ""}${discount ? `. Their $${(discount / 100).toFixed(2)} discount was shared with everyone else` : ""}. PayPal payout ${result.payoutBatchId ?? ""}.`,
    });
  }
  return { winnerId, discount, result };
}
