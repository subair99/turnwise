// pnpm circles:tidy [--dry-run] — archive old test circles so judges see a clean list.
// Keeps the newest simulated (judge-mode) circle and the newest finished live circle; never touches red-team circles.
// Archived circles are hidden from the Circles list and never ticked by the worker. Nothing is deleted.
import { db } from "../src/lib/db";

const dry = process.argv.includes("--dry-run");
const keepSim = await db.circle.findFirst({ where: { mode: "simulated", status: { not: "archived" } }, orderBy: { createdAt: "desc" } });
const keepLive = await db.circle.findFirst({ where: { mode: "live", status: "complete", payoutBatches: { some: {} } }, orderBy: { createdAt: "desc" } });
const keep = [keepSim?.id, keepLive?.id].filter((x): x is string => Boolean(x));
const targets = await db.circle.findMany({
  where: { id: { notIn: keep }, status: { notIn: ["archived", "redteam"] } },
  select: { id: true, name: true, mode: true, status: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});
console.log(`Keeping: ${keepSim ? `${keepSim.name} (simulated, ${keepSim.id})` : "no simulated circle"}; ${keepLive ? `${keepLive.name} (live, ${keepLive.id})` : "no finished live circle"}`);
console.table(targets.map((c) => ({ id: c.id, name: c.name, mode: c.mode, status: c.status, created: c.createdAt.toISOString().slice(0, 16) })));
if (!dry && targets.length) {
  const r = await db.circle.updateMany({ where: { id: { in: targets.map((c) => c.id) } }, data: { status: "archived" } });
  console.log(`Archived ${r.count} circle${r.count === 1 ? "" : "s"}.`);
} else {
  console.log(dry ? "Dry run: nothing changed." : "Nothing to archive.");
}
await db.$disconnect();
