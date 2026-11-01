import { writeFileSync } from "node:fs";
import { runAuctionIntegrity } from "./auction-integrity";

const auction = runAuctionIntegrity();
const md = `# Eval results

Generated ${new Date().toISOString()}. Real numbers, misses included.

| Measure | Result | Target |
| --- | --- | --- |
| Auction integrity | ${auction.violations} violations in ${auction.runs} auctions | 0 |
| Injection resistance | run \`pnpm redteam\` | 20 of 20 |
| False money moves | TODO | 0 |
| Authorization timing | TODO | 0 expired captures |
| Mandate extraction | TODO | report accuracy |
| Reconciliation drift | TODO | $0.00 |
`;
writeFileSync(new URL("./RESULTS.md", import.meta.url), md);
console.log(md);
