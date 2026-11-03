// pnpm mcp:smoke [url] [circleId] — connects to the MCP endpoint like an outside assistant would,
// lists the tools and reads a charter. Default URL: $APP_BASE_URL/api/mcp.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2] ?? `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/mcp`;
const circleId = process.argv[3];
const client = new Client({ name: "turnwise-smoke", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const tools = await client.listTools();
console.log(`Connected to ${url}`);
console.log("Tools:", tools.tools.map((t) => t.name).join(", "));
if (circleId) {
  const r = (await client.callTool({ name: "read_charter", arguments: { circleId } })) as { content?: { text?: string }[] };
  console.log(r.content?.[0]?.text?.slice(0, 800));
}
const bad = (await client.callTool({ name: "submit_bid", arguments: { circleId: circleId ?? "none", memberId: "none", memberToken: "forged", discountCents: 900 } })) as { content?: { text?: string }[] };
console.log("Forged bid ->", bad.content?.[0]?.text?.replace(/\s+/g, " "));
await client.close();
