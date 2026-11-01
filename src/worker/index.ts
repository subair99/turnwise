// Background worker: runs every job on each tick. Jobs are idempotent (pure step functions + request IDs).
import { now, isAccelerated } from "../domain/clock";
import { runPreauthJob } from "./jobs/preauth";
import { runCaptureJob } from "./jobs/capture";
import { runDefaultStepsJob } from "./jobs/default-steps";
import { runReconcileJob } from "./jobs/reconcile";

const TICK_MS = isAccelerated() ? 1_000 : 60_000;

async function tick() {
  const t = now();
  for (const [name, job] of [
    ["preauth", runPreauthJob],
    ["capture", runCaptureJob],
    ["default-steps", runDefaultStepsJob],
    ["reconcile", runReconcileJob],
  ] as const) {
    try {
      await job(t);
    } catch (err) {
      console.error(`[worker] ${name} failed`, err);
    }
  }
}

console.log(`[worker] started (${isAccelerated() ? "demo time, accelerated" : "real time"})`);
setInterval(tick, TICK_MS);
void tick();
