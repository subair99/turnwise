"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { submitBid } from "@/services/auction";

// Demo: an outside assistant tries a $9 bid for the first member still waiting. The gate decides.
export async function outsideBid(circleId: string) {
  const cycle = await db.cycle.findFirst({ where: { circleId, state: "auction" } });
  if (!cycle) return;
  const member = await db.member.findFirst({ where: { circleId, collectedCycle: null }, orderBy: { id: "asc" } });
  if (!member) return;
  await submitBid(db, circleId, cycle.number, member.id, 900, "mcp", "Bid from an outside assistant");
  revalidatePath(`/circles/${circleId}/auction`);
}
