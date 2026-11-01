// For each member who has collected: 5 days before each later due date, propose create_preauth to the gate.
export async function runPreauthJob(_now: Date): Promise<void> {
  // TODO: load cycles where now >= dueAt - preauthLeadDays and no PreAuthorization exists for that member+cycle
  // TODO: build GateContext, call execute("guardian", { kind: "create_preauth", ... })
  // TODO: if vaulting is unavailable, store the approve link and notify the member (one-tap fallback)
}
