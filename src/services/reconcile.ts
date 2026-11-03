// Compares the circle cash the ledger says each PayPal object moved with what PayPal itself reports.
// Entries are grouped by PayPal object (a failed payout's reversal belongs with its batch). Target drift: $0.00.
import type { PrismaClient } from "@prisma/client";
import { accounts, type Posting } from "@/domain/ledger";
import { paypalCashMovement, type PayPalKind } from "@/gate/readonly";

export interface ReconcileRow {
  entry: string;
  paypalId: string | null;
  kind: PayPalKind | "none";
  ledgerCents: number;
  paypalCents: number | null;
  status: string;
  driftCents: number;
}

function kindFor(description: string, id: string): PayPalKind {
  if (/^Settlement|^Deposit refunded|^Payout failed/.test(description)) return "payout_batch";
  if (/^INV2-/.test(id)) return "invoice";
  return "capture";
}

export async function reconcileCircle(db: PrismaClient, circleId: string) {
  const entries = await db.ledgerEntry.findMany({ where: { circleId }, orderBy: { createdAt: "asc" } });
  const groups = new Map<string, { descriptions: string[]; cash: number }>();
  const rows: ReconcileRow[] = [];
  for (const e of entries) {
    const postings = e.postings as unknown as Posting[];
    const cash = postings.filter((p) => p.account === accounts.cash).reduce((s, p) => s + p.debit - p.credit, 0);
    if (!e.paypalObjectId) {
      if (cash !== 0) rows.push({ entry: e.description, paypalId: null, kind: "none", ledgerCents: cash, paypalCents: null, status: "NO PAYPAL ID", driftCents: Math.abs(cash) });
      continue; // e.g. deposit applied: no cash moves
    }
    const g = groups.get(e.paypalObjectId) ?? { descriptions: [], cash: 0 };
    g.descriptions.push(e.description);
    g.cash += cash;
    groups.set(e.paypalObjectId, g);
  }
  for (const [id, g] of groups) {
    const entry = g.descriptions.join(" + ");
    const kind = kindFor(g.descriptions[0]!, id);
    try {
      const p = await paypalCashMovement(kind, id);
      rows.push({ entry, paypalId: id, kind, ledgerCents: g.cash, paypalCents: p.cents, status: p.status, driftCents: Math.abs(g.cash - p.cents) });
    } catch (err) {
      rows.push({ entry, paypalId: id, kind, ledgerCents: g.cash, paypalCents: null, status: `lookup failed: ${(err as Error).message.slice(0, 60)}`, driftCents: Math.abs(g.cash) });
    }
  }
  const driftCents = rows.reduce((s, r) => s + r.driftCents, 0);
  return { circleId, checked: rows.length, unverified: rows.filter((r) => r.paypalCents === null).length, driftCents, rows };
}
