// pnpm db:seed — loads the judge-mode demo circle (8 fictional members, simulated history, no PayPal objects).
// A live sandbox circle is started from Judge mode in the app (it needs saved wallets; see JUDGES.md).
import { PrismaClient } from "@prisma/client";
import { seedSimulatedCircle } from "../src/services/demo-seed";

const db = new PrismaClient();
const id = await seedSimulatedCircle(db);
console.log(`Demo circle loaded: /circles/${id}`);
await db.$disconnect();
