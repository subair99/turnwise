// Charter rules, checked by code. The Treasurer drafts; this file decides what is acceptable.
import { assertCents, type Cents } from "../lib/money";

export interface CharterBody {
  contributionCents: Cents;
  cadence: "weekly" | "monthly";
  members: number;
  turnMode: "auction" | "fixed" | "lottery";
  depositOn: boolean;
  defaultSteps: { graceDays: number; cureHours: number };
  preauthLeadDays: number;
  voteQuorum: number;
  label?: string;
}

export interface CharterDraftLike {
  contributionCents: number;
  cadence: "weekly" | "monthly";
  members: number;
  turnMode: "auction" | "fixed" | "lottery";
  depositOn: boolean;
  graceDays: number;
  cureHours: number;
  preauthLeadDays: number;
  voteQuorum: number;
}

export function validateCharter(d: CharterDraftLike): { body: CharterBody; problems: string[] } {
  const problems: string[] = [];
  const intIn = (v: number, lo: number, hi: number, name: string) => {
    if (!Number.isInteger(v) || v < lo || v > hi) problems.push(`${name} must be a whole number from ${lo} to ${hi}`);
  };
  try {
    assertCents(d.contributionCents);
  } catch {
    problems.push("contribution must be a whole number of cents");
  }
  if (d.contributionCents < 100 || d.contributionCents > 1_000_000) problems.push("contribution must be between $1 and $10,000");
  intIn(d.members, 2, 20, "members");
  intIn(d.graceDays, 0, 14, "grace days");
  intIn(d.cureHours, 0, 168, "cure window hours");
  // A pre-authorization must still be valid after the grace days and cure window (PayPal: 29 days).
  intIn(d.preauthLeadDays, 1, 10, "pre-authorization lead days");
  if (d.preauthLeadDays + d.graceDays + d.cureHours / 24 > 28) problems.push("lead days + grace + cure must fit inside PayPal's 29-day authorization");
  if (!(d.voteQuorum >= 0.5 && d.voteQuorum <= 1)) problems.push("vote quorum must be between 0.5 and 1");

  return {
    problems,
    body: {
      contributionCents: d.contributionCents,
      cadence: d.cadence,
      members: d.members,
      turnMode: d.turnMode,
      depositOn: d.depositOn,
      defaultSteps: { graceDays: d.graceDays, cureHours: d.cureHours },
      preauthLeadDays: d.preauthLeadDays,
      voteQuorum: d.voteQuorum,
    },
  };
}

export type CharterField = "contributionCents" | "members" | "depositOn" | "graceDays" | "cureHours" | "turnMode";

export function toDraft(b: CharterBody): CharterDraftLike {
  return {
    contributionCents: b.contributionCents,
    cadence: b.cadence,
    members: b.members,
    turnMode: b.turnMode,
    depositOn: b.depositOn,
    graceDays: b.defaultSteps.graceDays,
    cureHours: b.defaultSteps.cureHours,
    preauthLeadDays: b.preauthLeadDays,
    voteQuorum: b.voteQuorum,
  };
}

export function applyChanges(b: CharterBody, changes: { field: CharterField; newValue: string }[]): CharterDraftLike {
  const d = toDraft(b);
  for (const c of changes) {
    switch (c.field) {
      case "depositOn":
        d.depositOn = /^(true|yes|on)$/i.test(c.newValue.trim());
        break;
      case "turnMode":
        if (c.newValue === "auction" || c.newValue === "fixed" || c.newValue === "lottery") d.turnMode = c.newValue;
        break;
      default:
        d[c.field] = Number(c.newValue);
    }
  }
  return d;
}
