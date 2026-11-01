import { createHash } from "node:crypto";

// Same circle + cycle + action + subject always gives the same PayPal-Request-Id,
// so a retried call can never move money twice.
export function requestId(circleId: string, cycle: number, action: string, subject = ""): string {
  const digest = createHash("sha256").update(`${circleId}|${cycle}|${action}|${subject}`).digest("hex");
  return `tw-${digest.slice(0, 40)}`;
}
