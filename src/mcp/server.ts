// Public MCP endpoint: outside assistants can read a charter and submit a sealed bid for a member.
// A bid needs that member's token, and goes through the same policy gate as the Turn Agents.
import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { db } from "../lib/db";
import { loadCircle } from "../services/gate-context";
import { submitBid } from "../services/auction";
import { verifyMemberToken } from "../services/member-token";

function text(value: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], ...(isError ? { isError: true } : {}) };
}

export function buildServer() {
  const server = new McpServer({ name: "turnwise", version: "0.3.0" });

  server.tool("read_charter", "Read a savings circle's approved rules and current cycle.", { circleId: z.string().max(64) }, async ({ circleId }) => {
    try {
      const { circle, charter, body } = await loadCircle(db, circleId);
      const open = circle.cycles.find((c) => c.state !== "closed");
      return text({
        circle: circle.name,
        charterHash: charter.hash,
        rules: body,
        members: circle.members.map((m) => ({ id: m.id, name: m.displayName, collected: m.collectedCycle !== null })),
        currentCycle: open ? { number: open.number, state: open.state, dueAt: open.dueAt } : null,
      });
    } catch {
      return text({ error: "circle not found or not approved" }, true);
    }
  });

  server.tool(
    "submit_bid",
    "Submit a sealed bid (discount in cents) for an earlier payout on behalf of a member. Requires the member's token.",
    {
      circleId: z.string().max(64),
      memberId: z.string().max(64),
      memberToken: z.string().max(64),
      discountCents: z.number().int().nonnegative().max(100_000_000),
    },
    async ({ circleId, memberId, memberToken, discountCents }) => {
      if (!verifyMemberToken(circleId, memberId, memberToken)) return text({ accepted: false, reasons: ["invalid member token"] }, true);
      let loaded;
      try {
        loaded = await loadCircle(db, circleId);
      } catch {
        return text({ accepted: false, reasons: ["circle not found or not approved"] }, true);
      }
      const { circle } = loaded;
      if (circle.status === "complete") return text({ accepted: false, reasons: ["circle complete"] }, true);
      if (!circle.members.some((m) => m.id === memberId)) return text({ accepted: false, reasons: ["not a member"] }, true);
      const open = circle.cycles.find((c) => c.state !== "closed");
      if (!open) return text({ accepted: false, reasons: ["no open cycle"] }, true);
      const r = await submitBid(db, circleId, open.number, memberId, discountCents, "mcp", "Bid from an outside assistant");
      return text({ accepted: r.accepted, reasons: r.reasons, cycle: open.number }, !r.accepted);
    },
  );

  return server;
}

export function startMcpServer(port = Number(process.env.MCP_PORT ?? 3001)): Promise<Server> {
  const http = createServer(async (req, res) => {
    if (!req.url?.startsWith("/mcp")) return void res.writeHead(404).end();
    if (req.method !== "POST") {
      // Stateless server: no SSE stream, no sessions.
      return void res.writeHead(405, { "Content-Type": "application/json", Allow: "POST" }).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }));
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 64_000) return void res.writeHead(413).end();
      chunks.push(c as Buffer);
    }
    let body: unknown;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    } catch {
      return void res.writeHead(400).end();
    }
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  return new Promise((resolve) => http.listen(port, () => resolve(http)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startMcpServer().then((s) => {
    const a = s.address();
    console.log(`[mcp] listening on :${typeof a === "object" && a ? a.port : "?"}/mcp`);
  });
}
