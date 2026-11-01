// Default steps, agreed in the charter before any money moves:
// due date -> reminder -> grace days -> cure window -> deposit applied -> member vote if more is owed.
export type LadderStep = "current" | "reminded" | "cure" | "deposit_due" | "resolved";

export interface LadderPolicy {
  graceDays: number;
  cureHours: number;
}

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;

// Pure function of time: safe to re-run on every worker tick.
export function ladderStep(dueAt: Date, now: Date, paid: boolean, policy: LadderPolicy): LadderStep {
  if (paid) return "resolved";
  const t = now.getTime();
  const due = dueAt.getTime();
  const cureStart = due + policy.graceDays * DAY;
  const cureEnd = cureStart + policy.cureHours * HOUR;
  if (t < due) return "current";
  if (t < cureStart) return "reminded";
  if (t < cureEnd) return "cure";
  return "deposit_due";
}

export type LadderAction = "send_reminder" | "open_cure_window" | "apply_deposit";

const ORDER: LadderStep[] = ["current", "reminded", "cure", "deposit_due"];
const ACTION_ON_ENTER: Partial<Record<LadderStep, LadderAction>> = {
  reminded: "send_reminder",
  cure: "open_cure_window",
  deposit_due: "apply_deposit",
};

// Actions for every step crossed since the last tick, in order, so a slow worker never skips one.
export function ladderActions(prev: LadderStep, next: LadderStep): LadderAction[] {
  if (next === "resolved" || prev === "resolved") return [];
  const from = ORDER.indexOf(prev);
  const to = ORDER.indexOf(next);
  const actions: LadderAction[] = [];
  for (let i = from + 1; i <= to; i++) {
    const a = ACTION_ON_ENTER[ORDER[i]!];
    if (a) actions.push(a);
  }
  return actions;
}
