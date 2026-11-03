import type { PrismaClient } from "@prisma/client";

export async function notice(
  db: PrismaClient,
  n: { circleId: string; memberId?: string; cycleNumber?: number; kind: string; text: string },
) {
  return db.notice.create({ data: { circleId: n.circleId, memberId: n.memberId ?? null, cycleNumber: n.cycleNumber ?? null, kind: n.kind, text: n.text } });
}
