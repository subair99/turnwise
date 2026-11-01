// Seeds the demo circle used by Judge mode: 8 fictional members, $100 a month, auction mode, deposit on.
import { PrismaClient } from "@prisma/client";
import { hashObject } from "../src/gate/hashing";

const prisma = new PrismaClient();

const NAMES = ["Ada", "Bola", "Chidi", "Dami", "Efe", "Funke", "Gbenga", "Halima"];

async function main() {
  const emails = (process.env.SANDBOX_MEMBER_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (emails.length < NAMES.length) {
    throw new Error(`Set SANDBOX_MEMBER_EMAILS to ${NAMES.length} sandbox personal-account emails.`);
  }

  const charterBody = {
    contributionCents: 10_000,
    cadence: "monthly",
    members: NAMES.length,
    turnMode: "auction",
    depositOn: true,
    defaultSteps: { graceDays: 3, cureHours: 48 },
    preauthLeadDays: 5,
    voteQuorum: 0.5,
  };

  const circle = await prisma.circle.create({ data: { name: "Lagos–London–Houston Circle" } });
  await prisma.charter.create({
    data: { circleId: circle.id, version: 1, hash: hashObject(charterBody), body: charterBody, frozen: true, approvals: [] },
  });

  for (const [i, name] of NAMES.entries()) {
    await prisma.member.create({ data: { circleId: circle.id, displayName: name, paypalEmail: emails[i]! } });
  }

  const start = new Date();
  for (let n = 1; n <= NAMES.length; n++) {
    const dueAt = new Date(start.getTime() + n * 30 * 24 * 3600 * 1000);
    await prisma.cycle.create({ data: { circleId: circle.id, number: n, dueAt, state: n === 1 ? "collecting" : "closed" } });
  }

  console.log(`Seeded circle ${circle.id}`);
}

main().finally(() => prisma.$disconnect());
