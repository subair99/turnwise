import type { Prisma, PrismaClient } from "@prisma/client";
import { assertBalanced, balances, type Entry } from "@/domain/ledger";

// Same request ID = same entry. A duplicate (e.g. a webhook after the API response) is ignored.
export async function postEntry(db: PrismaClient, circleId: string, entry: Entry & { requestId: string }): Promise<{ posted: boolean }> {
  assertBalanced(entry);
  try {
    await db.ledgerEntry.create({
      data: {
        circleId,
        description: entry.description,
        postings: entry.postings as unknown as Prisma.InputJsonValue,
        paypalObjectId: entry.paypalObjectId ?? null,
        requestId: entry.requestId,
      },
    });
    return { posted: true };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { posted: false };
    throw e;
  }
}

export async function loadEntries(db: PrismaClient, circleId: string): Promise<Entry[]> {
  const rows = await db.ledgerEntry.findMany({ where: { circleId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    description: r.description,
    postings: r.postings as unknown as Entry["postings"],
    paypalObjectId: r.paypalObjectId ?? undefined,
    requestId: r.requestId ?? undefined,
  }));
}

export async function loadBalances(db: PrismaClient, circleId: string) {
  return balances(await loadEntries(db, circleId));
}

export const contributionRequestId = (circleId: string, cycle: number, memberId: string) =>
  `contrib:${circleId}:${cycle}:${memberId}`;
