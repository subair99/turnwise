// Background worker: moves every approved circle forward on each tick. All steps are idempotent.
import { db } from "../lib/db";
import { isAccelerated, now } from "../domain/clock";
import { tickAll } from "../services/runner";
import { runReconcileJob } from "./jobs/reconcile";

// Every 2 s by default: live demo circles keep their own clock (one circle day can pass in under a second).
const TICK_MS = Number(process.env.WORKER_TICK_MS ?? (isAccelerated() ? 1_000 : 2_000));
let busy = false;

async function tick() {
  if (busy) return; // never overlap ticks
  busy = true;
  try {
    const t = now();
    await tickAll(db, t);
    await runReconcileJob(t);
  } catch (err) {
    console.error("[worker] tick failed", err);
  } finally {
    busy = false;
  }
}

console.log(`[worker] started (${isAccelerated() ? "demo time, accelerated" : "real time"})`);
setInterval(tick, TICK_MS);
void tick();
