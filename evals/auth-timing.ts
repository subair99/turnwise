// Authorization timing: PayPal authorizations are honoured for 29 days. Turnwise creates one per contribution,
// `preauthLeadDays` before the due date, and may retry capture until the deposit step (grace days + cure window).
// For every charter the validator accepts, the oldest possible capture must be < 29 days old.
// Also simulates 8-cycle circles with worker lag to confirm no capture lands on an expired authorization.
import { validateCharter } from "../src/domain/charter";
import { preauthDueAt } from "../src/domain/clock";

const DAY = 86_400_000;

export function runAuthTiming() {
  let accepted = 0;
  let rejected = 0;
  let unsafeAccepted = 0;
  let safeRejected = 0;
  let capturesChecked = 0;
  let expiredCaptures = 0;
  let maxAgeDays = 0;
  let seed = 11;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

  for (let lead = 1; lead <= 10; lead++)
    for (let grace = 0; grace <= 14; grace++)
      for (let cure = 0; cure <= 168; cure += 12) {
        const worst = lead + grace + cure / 24;
        const { problems } = validateCharter({ contributionCents: 500, cadence: "monthly", members: 8, turnMode: "auction", depositOn: true, graceDays: grace, cureHours: cure, preauthLeadDays: lead, voteQuorum: 0.5 });
        if (problems.length) {
          rejected++;
          if (worst < 29) safeRejected++;
          continue;
        }
        accepted++;
        if (worst >= 29) unsafeAccepted++;

        // 8 cycles x 8 members, capture somewhere between the due date and the deposit step, plus up to 1h worker lag.
        const start = Date.UTC(2026, 10, 1);
        for (let c = 1; c <= 8; c++) {
          const due = new Date(start + c * 30 * DAY);
          const authAt = preauthDueAt(due, lead).getTime();
          for (let m = 0; m < 8; m++) {
            const captureAt = due.getTime() + rand() * (grace * DAY + cure * 3_600_000) + rand() * 3_600_000;
            const age = (captureAt - authAt) / DAY;
            maxAgeDays = Math.max(maxAgeDays, age);
            capturesChecked++;
            if (age >= 29) expiredCaptures++;
          }
        }
      }
  return { charters: accepted + rejected, accepted, rejected, unsafeAccepted, safeRejected, capturesChecked, expiredCaptures, maxAgeDays: Math.round(maxAgeDays * 10) / 10 };
}
