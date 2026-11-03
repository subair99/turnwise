// Mandates: the Turn Agent reads a member's words; CODE decides whether the mandate is enforceable.
// Rule: the member must state a cap — an amount ("$2") or a clear no ("I won't pay anything").
import type { Prisma, PrismaClient } from "@prisma/client";
import { extractMandate } from "@/agents/turn-agent";
import { hashObject } from "@/gate/hashing";
import { now } from "@/domain/clock";

const AMOUNT = /(?:\$|usd\s?|₦|ngn\s?)\s?(\d+(?:[.,]\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s?(?:dollars?|usd|cents?|naira)/gi;
const REFUSES = /\b(won'?t|will not|wont|not|never|don'?t|do not)\b[^.]{0,30}\b(pay|bid|spend)\b|\b(nothing|no discount|zero|\$?0(?:\.00)?)\b/i;

// Amounts the member wrote, in cents.
export function statedAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const raw = (m[1] ?? m[2] ?? "").replace(",", ".");
    const isCents = /cents?/i.test(m[0]);
    const v = Number(raw);
    if (Number.isFinite(v)) out.push(Math.round(isCents ? v : v * 100));
  }
  return out;
}

export function capFromText(text: string): { stated: boolean; ceiling: number | null } {
  const amounts = statedAmounts(text);
  if (amounts.length) return { stated: true, ceiling: Math.max(...amounts) };
  if (REFUSES.test(text)) return { stated: true, ceiling: 0 };
  return { stated: false, ceiling: null };
}

export async function mandateFromText(db: PrismaClient, memberId: string, text: string) {
  const cap = capFromText(text);
  if (!cap.stated) {
    return {
      saved: false as const,
      quarantined: false,
      question: "What's the most you'd pay to collect earlier? Give an amount like $2, or say you won't pay anything.",
      unenforceableTerms: [] as string[],
    };
  }

  const r = await extractMandate(text, now());
  if (r.quarantined) return { saved: false as const, quarantined: true, reasons: r.reasons };
  const m = r.mandate;

  // The model's number never exceeds what the member actually wrote.
  const maxDiscountCents = Math.min(m.maxDiscountCents, cap.ceiling ?? 0);
  const body = {
    deadline: m.deadline,
    targetCents: m.targetCents,
    maxDiscountCents,
    minAcceptCents: m.minAcceptCents,
    notes: m.unenforceableTerms, // shown to the member; not enforced
    memberId,
    at: new Date().toISOString(),
  };
  const mandate = await db.mandate.create({
    data: { memberId, hash: hashObject(body), body: body as unknown as Prisma.InputJsonValue, sourceText: text },
  });
  return { saved: true as const, mandate };
}

// Kill switch: the member's agent stops at once; any bid it makes is refused by the gate.
export async function revokeMandate(db: PrismaClient, memberId: string) {
  return db.mandate.updateMany({ where: { memberId, revoked: false }, data: { revoked: true } });
}
