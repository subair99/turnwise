// On the due date: propose capture_preauth for each authorized pre-authorization not already paid another way.
export async function runCaptureJob(_now: Date): Promise<void> {
  // TODO: load PreAuthorization rows with status "authorized" whose cycle dueAt <= now
  // TODO: execute("guardian", { kind: "capture_preauth", ... }); void instead if the member already paid the invoice
}
