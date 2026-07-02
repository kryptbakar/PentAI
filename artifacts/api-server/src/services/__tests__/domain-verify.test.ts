import { describe, it, expect } from "vitest";
import { newVerificationToken, expectedTxtValue, txtRecordsContain } from "../domain-verify";

describe("domain-verify", () => {
  it("generates a hyphen-free token", () => {
    const token = newVerificationToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("formats the expected TXT value", () => {
    expect(expectedTxtValue("abc123")).toBe("pentai-verify=abc123");
  });

  it("matches when a TXT record contains the proof (including chunked records)", () => {
    const token = "deadbeef";
    expect(txtRecordsContain([["pentai-verify=deadbeef"]], token)).toBe(true);
    // DNS may split a record into multiple chunks that must be concatenated.
    expect(txtRecordsContain([["pentai-verify=", "deadbeef"]], token)).toBe(true);
    // Unrelated records present alongside the proof.
    expect(txtRecordsContain([["v=spf1 -all"], ["pentai-verify=deadbeef"]], token)).toBe(true);
  });

  it("does not match a wrong or absent token", () => {
    expect(txtRecordsContain([["pentai-verify=other"]], "deadbeef")).toBe(false);
    expect(txtRecordsContain([["v=spf1 -all"]], "deadbeef")).toBe(false);
    expect(txtRecordsContain([], "deadbeef")).toBe(false);
  });
});
