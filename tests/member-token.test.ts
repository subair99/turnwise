import { describe, expect, it } from "vitest";
import { memberToken, verifyMemberToken } from "@/services/member-token";

describe("MCP member tokens", () => {
  it("verifies the right member and circle only", () => {
    const t = memberToken("c1", "ada");
    expect(verifyMemberToken("c1", "ada", t)).toBe(true);
    expect(verifyMemberToken("c1", "bola", t)).toBe(false);
    expect(verifyMemberToken("c2", "ada", t)).toBe(false);
    expect(verifyMemberToken("c1", "ada", "")).toBe(false);
  });
});
