// Per-member bid tokens for the public MCP endpoint: HMAC-SHA256(secret, circleId:memberId).
// Shown to each member in their circle view; an outside assistant needs it to bid for that member.
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.MCP_TOKEN_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("MCP_TOKEN_SECRET (16+ characters) is required in production");
  return "turnwise-dev-only-secret";
}

export function memberToken(circleId: string, memberId: string): string {
  return `tw_${createHmac("sha256", secret()).update(`${circleId}:${memberId}`).digest("base64url").slice(0, 32)}`;
}

export function verifyMemberToken(circleId: string, memberId: string, token: string): boolean {
  const expected = Buffer.from(memberToken(circleId, memberId));
  const given = Buffer.from(token ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
