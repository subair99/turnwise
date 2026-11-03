// Prints SANDBOX_VAULTS for your hosting env, so judge mode there can start a live circle with wallets saved locally.
// Treat the output like a password: put it in Render's environment, not in git or chat.
import { db } from "../src/lib/db";

const emails = (process.env.SANDBOX_MEMBER_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
const pairs: string[] = [];
for (const email of emails) {
  const m = await db.member.findFirst({ where: { paypalEmail: email, vaultId: { not: null } }, orderBy: { id: "desc" } });
  if (m?.vaultId) pairs.push(`${email}=${m.vaultId}`);
  else console.error(`no saved wallet for ${email} (run pnpm money:loop)`);
}
console.log(`SANDBOX_VAULTS=${pairs.join(",")}`);
await db.$disconnect();
