import { type Cents, assertCents } from "../lib/money";

export interface DepositApplication {
  applied: Cents;      // taken from the deposit into the pot
  remaining: Cents;    // deposit left for this member
  shortfall: Cents;    // still owed after the deposit; goes to a member vote
}

export function applyDeposit(deposit: Cents, owed: Cents): DepositApplication {
  assertCents(deposit);
  assertCents(owed);
  const applied = Math.min(deposit, owed);
  return { applied, remaining: deposit - applied, shortfall: owed - applied };
}

// A member who collects in the final cycle has nobody left to protect, so no deposit is taken.
export function depositRequired(collectCycle: number, totalCycles: number, depositOn: boolean): boolean {
  return depositOn && collectCycle < totalCycles;
}
