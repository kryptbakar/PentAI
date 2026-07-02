import { describe, it, expect } from "vitest";
import { evaluateSecurityHeaders } from "../headers";

describe("evaluateSecurityHeaders", () => {
  it("flags every missing header on a bare response", () => {
    const findings = evaluateSecurityHeaders({}, "example.com");
    const titles = findings.map((f) => f.title);
    expect(titles).toContain("Missing HTTP Strict Transport Security (HSTS)");
    expect(titles).toContain("Missing Content-Security-Policy (CSP)");
    expect(titles).toContain("Missing X-Content-Type-Options");
    expect(titles.some((t) => t.includes("X-Frame-Options"))).toBe(true);
  });

  it("returns a single info finding when all headers are present", () => {
    const findings = evaluateSecurityHeaders(
      {
        "Strict-Transport-Security": "max-age=63072000",
        "Content-Security-Policy": "default-src 'self'",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
      },
      "example.com",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
  });

  it("accepts CSP frame-ancestors as clickjacking protection instead of X-Frame-Options", () => {
    const findings = evaluateSecurityHeaders(
      { "content-security-policy": "default-src 'self'; frame-ancestors 'none'" },
      "example.com",
    );
    expect(findings.some((f) => f.title.includes("X-Frame-Options"))).toBe(false);
  });

  it("flags insecure cookies (missing Secure / HttpOnly)", () => {
    const findings = evaluateSecurityHeaders({ "set-cookie": "session=abc; Path=/" }, "example.com");
    const titles = findings.map((f) => f.title);
    expect(titles).toContain("Cookie without Secure flag");
    expect(titles).toContain("Cookie without HttpOnly flag");
  });

  it("does not flag a fully-hardened cookie", () => {
    const findings = evaluateSecurityHeaders(
      { "set-cookie": "session=abc; Path=/; Secure; HttpOnly; SameSite=Strict" },
      "example.com",
    );
    expect(findings.some((f) => f.title.startsWith("Cookie without"))).toBe(false);
  });
});
