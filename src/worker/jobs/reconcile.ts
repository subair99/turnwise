// Compares the ledger with PayPal Transaction Search and records the drift for the README.
export async function runReconcileJob(_now: Date): Promise<void> {
  // TODO: run at most once per (circle) day; searchTransactions() via a gate read-only helper
  // TODO: match by PayPal IDs; write drift (target $0.00) to AuditLog and evals/RESULTS.md
}
