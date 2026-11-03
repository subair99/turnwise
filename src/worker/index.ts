// Background worker: moves every approved circle forward on each tick. All steps are idempotent.
import { db } from "../lib/db";
import { isAccelerated, now } from "../domain/clock";
import { tickAll } from "../services/runner";
import { runReconcileJob } from "./jobs/reconcile";

const TICK_MS = isAccelerated() ? 1_000 : 60_000;
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
