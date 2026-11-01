// Advances the default ladder for every unpaid contribution and emits actions for each step crossed.
import { ladderActions, ladderStep } from "../../domain/default-ladder";

export async function runDefaultStepsJob(_now: Date): Promise<void> {
  // TODO: for each unpaid member+cycle: next = ladderStep(dueAt, now, paid, policy)
  // TODO: for each action in ladderActions(stored, next): send reminder / open cure window / execute apply_deposit
  // TODO: if applyDeposit() leaves a shortfall, open a member vote
  void ladderActions;
  void ladderStep;
}
