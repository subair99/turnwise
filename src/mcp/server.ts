// Public MCP endpoint: outside assistants can read a charter and submit a bid.
// Every bid goes through the same policy gate as the Turn Agents.
import { createServer } from "node:http";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

function buildServer() {
  const server = new McpServer({ name: "turnwise", version: "0.1.0" });

  server.tool("read_charter", { circleId: z.string() }, async ({ circleId }) => {
    // TODO: load the approved charter and its hash from the database
    return { content: [{ type: "text", text: JSON.stringify({ circleId, todo: "load charter" }) }] };
  });

  server.tool(
    "submit_bid",
    { circleId: z.string(), memberId: z.string(), mandateHash: z.string(), discountCents: z.number().int().nonnegative() },
    async (args) => {
      // TODO: build GateContext and call evaluate({ kind: "accept_bid", ... }); store Bid with source "mcp"
      return { content: [{ type: "text", text: JSON.stringify({ received: args, todo: "gate check" }) }] };
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
  // Stateless mode: a fresh server and transport per request.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}).listen(port, () => console.log(`[mcp] listening on :${port}/mcp`));
