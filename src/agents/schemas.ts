import { z } from "zod";

const cents = z.number().int().nonnegative();

export const CharterDraft = z.object({
  contributionCents: cents.describe("Contribution per member per cycle in cents, e.g. $100 = 10000"),
  cadence: z.enum(["weekly", "monthly"]),
  members: z.number().int(),
  turnMode: z.enum(["auction", "fixed", "lottery"]),
  depositOn: z.boolean(),
  graceDays: z.number().int(),
  cureHours: z.number().int(),
  preauthLeadDays: z.number().int(),
  voteQuorum: z.number(),
  clarifyingQuestions: z.array(z.string()).describe("Questions about anything vague or assumed; empty if none"),
});

export const MandateDraft = z.object({
  deadline: z.string().nullable().describe("ISO date by which the member needs the pot, or null"),
  targetCents: cents.nullable(),
  maxDiscountCents: cents.describe("Most the member will pay to go earlier, in cents; 0 if they won't pay"),
  minAcceptCents: cents.describe("Least the member wants as a dividend for waiting, in cents"),
  unenforceableTerms: z.array(z.string()).describe("Terms code cannot check"),
  clarifyingQuestion: z.string().nullable(),
});

export const BidProposal = z.object({
  discountCents: cents,
  explanation: z.string().describe("One sentence for the member"),
});

export const AmendmentDraft = z.object({
  conflictsWith: z.array(z.string()).describe("Charter rules the request would change"),
  explanation: z.string().describe("Plain explanation for the members"),
  changes: z.array(
    z.object({
      field: z.enum(["contributionCents", "members", "depositOn", "graceDays", "cureHours", "turnMode"]),
      newValue: z.string(),
    }),
  ),
});

export type CharterDraft = z.infer<typeof CharterDraft>;
export type MandateDraft = z.infer<typeof MandateDraft>;
export type BidProposal = z.infer<typeof BidProposal>;
export type AmendmentDraft = z.infer<typeof AmendmentDraft>;
