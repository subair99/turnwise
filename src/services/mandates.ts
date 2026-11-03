// Mandates: the Turn Agent reads a member's words; CODE decides what is enforceable (src/domain/mandate-cap.ts).
import type { Prisma, PrismaClient } from "@prisma/client";
import { extractMandate } from "@/agents/turn-agent";
import { screen } from "@/agents/quarantine";
import { capFromText } from "@/domain/mandate-cap";
import { hashObject } from "@/gate/hashing";
import { now } from "@/domain/clock";

export const CAP_QUESTION = "What's the most you'd pay to collect earlier? Give an amount like $2, or say you won't pay anything.";

export type Interpretation =
  | { status: "quarantined"; reasons: string[] }
  | { status: "question"; question: string }
  | {
      status: "saved";
      body: { deadline: string | null; targetCents: number | null; maxDiscountCents: number; minAcceptCents: number; notes: string[] };
      modelMaxDiscountCents: number; // what the model proposed, before code applied the member's stated cap
    };

// No database: used by mandateFromText, the evals and the red team.
export async function interpretMandate(text: string, today = now()): Promise<Interpretation> {
  const q = screen(text);
  if (q.quarantined) return { status: "quarantined", reasons: q.reasons };
  const cap = capFromText(text);
  if (!cap.stated || cap.ceiling === null) return { status: "question", question: CAP_QUESTION };

  const r = await extractMandate(text, today);
  if (r.quarantined) return { status: "quarantined", reasons: r.reasons };
  const m = r.mandate;
  return {
    status: "saved",
    modelMaxDiscountCents: m.maxDiscountCents,
    body: {
      deadline: m.deadline,
      targetCents: m.targetCents,
      maxDiscountCents: Math.min(m.maxDiscountCents, cap.ceiling), // never above what the member wrote
      minAcceptCents: m.minAcceptCents,
      notes: m.unenforceableTerms, // shown to the member; not enforced
    },
  };
}

export async function mandateFromText(db: PrismaClient, memberId: string, text: string) {
  const r = await interpretMandate(text);
  if (r.status === "quarantined") return { saved: false as const, quarantined: true, reasons: r.reasons };
  if (r.status === "question") return { saved: false as const, quarantined: false, question: r.question, unenforceableTerms: [] as string[] };

  const body = { ...r.body, memberId, at: new Date().toISOString() };
  const mandate = await db.mandate.create({
    data: { memberId, hash: hashObject(body), body: body as unknown as Prisma.InputJsonValue, sourceText: text },
  });
  return { saved: true as const, mandate };
}

// Kill switch: the member's agent stops at once; any bid it makes is refused by the gate.
export async function revokeMandate(db: PrismaClient, memberId: string) {
  return db.mandate.updateMany({ where: { memberId, revoked: false }, data: { revoked: true } });
}
