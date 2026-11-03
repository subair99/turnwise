// Public MCP endpoint: outside assistants can read a charter and submit a sealed bid.
// Every bid goes through the same policy gate as the Turn Agents.
// TODO (Stage 6): require a per-member token before accepting bids.
import { createServer } from "node:http";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { db } from "../lib/db";
import { loadCircle } from "../services/gate-context";
import { submitBid } from "../services/auction";

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function buildServer() {
  const server = new McpServer({ name: "turnwise", version: "0.2.0" });

  server.tool("read_charter", { circleId: z.string() }, async ({ circleId }) => {
    const { circle, charter, body } = await loadCircle(db, circleId);
    const open = circle.cycles.find((c) => c.state !== "closed");
    return text({
      circle: circle.name,
      charterHash: charter.hash,
      rules: body,
      members: circle.members.map((m) => ({ id: m.id, name: m.displayName, collected: m.collectedCycle !== null })),
      currentCycle: open ? { number: open.number, state: open.state, dueAt: open.dueAt } : null,
    });
  });

  server.tool(
    "submit_bid",
    { circleId: z.string(), memberId: z.string(), discountCents: z.number().int().nonnegative() },
    async ({ circleId, memberId, discountCents }) => {
      const { circle } = await loadCircle(db, circleId);
      const open = circle.cycles.find((c) => c.state !== "closed");
      if (!open) return text({ accepted: false, reasons: ["circle complete"] });
      const r = await submitBid(db, circleId, open.number, memberId, discountCents, "mcp", "Bid from an outside assistant");
      return text({ accepted: r.accepted, reasons: r.reasons, cycle: open.number });
    },
  );

  return server;
}

const port = Number(process.env.MCP_PORT ?? 3001);

createServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}).listen(port, () => console.log(`[mcp] listening on :${port}/mcp`));
