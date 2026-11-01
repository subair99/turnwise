import { z } from "zod";

const cents = z.number().int().nonnegative();

export const CharterDraft = z.object({
  contributionCents: cents,
  cadence: z.enum(["weekly", "monthly"]),
  members: z.number().int().min(3).max(20),
  turnMode: z.enum(["auction", "fixed", "lottery"]),
  depositOn: z.boolean(),
  defaultSteps: z.object({ graceDays: z.number().int().min(0).max(14), cureHours: z.number().int().min(0).max(168) }),
  preauthLeadDays: z.number().int().min(1).max(10),
  voteQuorum: z.number().min(0.5).max(1),
  clarifyingQuestions: z.array(z.string()).describe("Ask instead of guessing when the organizer's text is vague"),
});

export const MandateDraft = z.object({
  deadline: z.string().nullable().describe("ISO date by which the member needs the pot, or null"),
  targetCents: cents.nullable(),
  maxDiscountCents: cents.describe("Most the member will pay to go earlier"),
  minAcceptCents: cents.describe("Least the member will accept to wait"),
  unenforceableTerms: z.array(z.string()).describe("Terms code cannot check, e.g. 'when I can'"),
  clarifyingQuestion: z.string().nullable(),
});

export const BidProposal = z.object({
  discountCents: cents,
  explanation: z.string().describe("One sentence in the member's language"),
});

export const AmendmentDraft = z.object({
  conflictsWith: z.array(z.string()).describe("Charter fields the request would change"),
  explanation: z.string(),
  proposedChanges: z.record(z.unknown()),
});

export type CharterDraft = z.infer<typeof CharterDraft>;
export type MandateDraft = z.infer<typeof MandateDraft>;
export type BidProposal = z.infer<typeof BidProposal>;
