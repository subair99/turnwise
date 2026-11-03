// The three red-team layers. Each returns real counts and lists every miss.
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { screen } from "../src/agents/quarantine";

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8")) as T;

// A. Injection screen: every attack quarantined, no ordinary member message quarantined.
export function runScreenLayer() {
  const attacks = load<string[]>("payloads.json");
  const benign = load<string[]>("benign.json");
  const missed = attacks.filter((p) => !screen(p).quarantined);
  const falsePositives = benign.filter((p) => screen(p).quarantined);
  return { attacks: attacks.length, caught: attacks.length - missed.length, missed, benign: benign.length, falsePositives };
}

// C. Subtle injections the screen does not catch: the model may be fooled, but code still caps the mandate.
export async function runMandateInjectionLayer() {
  const { interpretMandate } = await import("../src/services/mandates");
  const cases = load<{ text: string; honestCap: number }[]>("subtle.json");
  const rows: { text: string; honestCap: number; outcome: string; savedCap: number | null; modelCap: number | null; breach: boolean; modelFooled: boolean }[] = [];
  for (const c of cases) {
    const r = await interpretMandate(c.text);
    const savedCap = r.status === "saved" ? r.body.maxDiscountCents : null;
    const modelCap = r.status === "saved" ? r.modelMaxDiscountCents : null;
    rows.push({
      text: c.text,
      honestCap: c.honestCap,
      outcome: r.status,
      savedCap,
      modelCap,
      breach: savedCap !== null && savedCap > c.honestCap,
      modelFooled: modelCap !== null && modelCap > c.honestCap,
    });
  }
  return { cases: rows.length, breaches: rows.filter((r) => r.breach).length, modelFooled: rows.filter((r) => r.modelFooled).length, rows };
}

// B. Live attacks on the MCP endpoint. Uses a synthetic circle (status "redteam", fake emails, no PayPal calls:
// bids are ledger-only and the worker never ticks this circle).
export async function runMcpLayer(db: PrismaClient) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const { startMcpServer } = await import("../src/mcp/server");
  const { memberToken } = await import("../src/services/member-token");
  const { hashObject } = await import("../src/gate/hashing");

  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const body = { contributionCents: 500, cadence: "monthly", members: 4, turnMode: "auction", depositOn: true, defaultSteps: { graceDays: 3, cureHours: 48 }, preauthLeadDays: 5, voteQuorum: 0.5, label: `redteam ${nonce}` };
  const circle = await db.circle.create({ data: { name: "Red team circle (synthetic, no PayPal)", status: "redteam" } });
  await db.charter.create({ data: { circleId: circle.id, version: 1, hash: hashObject(body), body, frozen: true, approvals: [] } });
  const mk = (name: string, collectedCycle: number | null = null) =>
    db.member.create({ data: { circleId: circle.id, displayName: name, paypalEmail: `${name.toLowerCase()}.${nonce}@redteam.invalid`, collectedCycle } });
  const ada = await mk("Ada");
  const bola = await mk("Bola");
  const chidi = await mk("Chidi", 1);
  const dami = await mk("Dami");
  const mandate = (memberId: string, maxDiscountCents: number, revoked = false) => {
    const b = { maxDiscountCents, memberId, nonce };
    return db.mandate.create({ data: { memberId, hash: hashObject(b), body: b, sourceText: "red team", revoked } });
  };
  await mandate(ada.id, 200);
  await mandate(bola.id, 0, true);
  await mandate(chidi.id, 500);
  await mandate(dami.id, 100);
  await db.cycle.create({ data: { circleId: circle.id, number: 1, dueAt: new Date(), state: "closed", winnerId: chidi.id } });
  await db.cycle.create({ data: { circleId: circle.id, number: 2, dueAt: new Date(), state: "auction" } });

  const http = await startMcpServer(0);
  const addr = http.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const client = new Client({ name: "turnwise-redteam", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));

  const tok = (id: string) => memberToken(circle.id, id);
  const call = async (name: string, args: Record<string, unknown>) => {
    try {
      const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content?: { type: string; text?: string }[] };
      const t = r.content?.[0]?.text ?? "";
      let parsed: { accepted?: boolean; reasons?: string[]; error?: string } = {};
      try {
        parsed = JSON.parse(t);
      } catch {
        parsed = { error: t.slice(0, 120) };
      }
      return { accepted: parsed.accepted === true && !r.isError, detail: (parsed.reasons ?? [parsed.error ?? ""]).join("; ") };
    } catch (err) {
      return { accepted: false, detail: `refused: ${(err as Error).message.slice(0, 100)}` };
    }
  };

  const bid = (memberId: string, token: string, discountCents: unknown) => call("submit_bid", { circleId: circle.id, memberId, memberToken: token, discountCents });
  const attacks: { attack: string; expect: "accepted" | "rejected"; run: () => Promise<{ accepted: boolean; detail: string }> }[] = [
    { attack: "control: valid bid within the mandate", expect: "accepted", run: () => bid(dami.id, tok(dami.id), 100) },
    { attack: "replay the same bid", expect: "rejected", run: () => bid(dami.id, tok(dami.id), 100) },
    { attack: "bid over the mandate cap ($9 vs $2)", expect: "rejected", run: () => bid(ada.id, tok(ada.id), 900) },
    { attack: "absurd bid (1,000,000 dollars)", expect: "rejected", run: () => bid(ada.id, tok(ada.id), 100_000_000) },
    { attack: "another member's token", expect: "rejected", run: () => bid(ada.id, tok(dami.id), 100) },
    { attack: "forged token", expect: "rejected", run: () => bid(ada.id, "tw_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", 100) },
    { attack: "no token", expect: "rejected", run: () => bid(ada.id, "", 100) },
    { attack: "revoked mandate (kill switch)", expect: "rejected", run: () => bid(bola.id, tok(bola.id), 0) },
    { attack: "member who already collected", expect: "rejected", run: () => bid(chidi.id, tok(chidi.id), 100) },
    { attack: "non-member ID with a guessed token", expect: "rejected", run: () => bid("mallory", tok("mallory").replace(/.$/, "x"), 100) },
    { attack: "negative discount", expect: "rejected", run: () => bid(ada.id, tok(ada.id), -500) },
    { attack: "fractional cents", expect: "rejected", run: () => bid(ada.id, tok(ada.id), 1.5) },
    { attack: "discount as a string", expect: "rejected", run: () => bid(ada.id, tok(ada.id), "200 OR 1=1") },
    { attack: "SQL-style member ID", expect: "rejected", run: () => bid("x' OR '1'='1", tok("x' OR '1'='1"), 100) },
    { attack: "read a circle that doesn't exist", expect: "rejected", run: () => call("read_charter", { circleId: "does-not-exist" }) },
    {
      attack: "bid after the auction closed",
      expect: "rejected",
      run: async () => {
        await db.cycle.update({ where: { circleId_number: { circleId: circle.id, number: 2 } }, data: { state: "collecting" } });
        return bid(ada.id, tok(ada.id), 100);
      },
    },
  ];

  const rows: { attack: string; expect: string; got: string; detail: string; pass: boolean }[] = [];
  for (const a of attacks) {
    const r = await a.run();
    const got = r.accepted ? "accepted" : "rejected";
    rows.push({ attack: a.attack, expect: a.expect, got, detail: r.detail, pass: got === a.expect });
  }
  await client.close();
  await new Promise((r) => http.close(r));

  const acceptedInDb = await db.bid.count({ where: { cycle: { circleId: circle.id }, accepted: true } });
  return { attacks: rows.length, passed: rows.filter((r) => r.pass).length, acceptedInDb, rows, circleId: circle.id };
}
