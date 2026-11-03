// Prints each member's MCP bid token for a circle:  pnpm mcp:token <circleId>   (default: latest circle)
import { db } from "../src/lib/db";
import { memberToken } from "../src/services/member-token";

const id = process.argv[2] ?? (await db.circle.findFirst({ where: { status: { not: "redteam" } }, orderBy: { createdAt: "desc" } }))?.id;
if (!id) throw new Error("No circle found");
const members = await db.member.findMany({ where: { circleId: id } });
console.log(`Circle ${id}`);
console.table(members.map((m) => ({ member: m.displayName, memberId: m.id, token: memberToken(id, m.id) })));
await db.$disconnect();
