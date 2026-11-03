// Real schedule by default. In demo mode, one circle day passes in DEMO_SECONDS_PER_DAY real seconds.
// The UI must label accelerated time as "demo time, accelerated".
const DAY = 24 * 3600 * 1000;
const startedAt = Date.now();

export function demoSecondsPerDay(): number {
  const v = Number(process.env.DEMO_SECONDS_PER_DAY ?? "0");
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function isAccelerated(): boolean {
  return demoSecondsPerDay() > 0;
}

export function now(): Date {
  const spd = demoSecondsPerDay();
  if (spd === 0) return new Date();
  const realElapsed = Date.now() - startedAt;
  const circleElapsed = (realElapsed / (spd * 1000)) * DAY;
  return new Date(startedAt + circleElapsed);
}

export function preauthDueAt(dueAt: Date, leadDays: number): Date {
  return new Date(dueAt.getTime() - leadDays * DAY);
}

// Per-circle demo clock, shared by every process (web app, worker, scripts): circle time runs
// `secondsPerDay` real seconds per circle day from `clockStartedAt`. Circles without one use `fallback`.
export function circleNow(c: { secondsPerDay: number | null; clockStartedAt: Date | null }, fallback: Date = now()): Date {
  if (!c.secondsPerDay || !c.clockStartedAt) return fallback;
  const start = c.clockStartedAt.getTime();
  return new Date(start + ((Date.now() - start) / (c.secondsPerDay * 1000)) * 24 * 3600 * 1000);
}
