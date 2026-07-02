import { describe, it, expect } from "vitest";
import { assertSafeHost } from "../dispatcher";

describe("assertSafeHost", () => {
  it("accepts plain hostnames and IPs", () => {
    for (const h of ["example.com", "app.example.com", "8.8.8.8", "sub-domain.co.uk"]) {
      expect(assertSafeHost(h)).toBe(h);
    }
  });

  it("rejects values that could be crafted as tool flags or shell metacharacters", () => {
    for (const h of ["-oN=/etc/passwd", "example.com; rm -rf /", "$(whoami)", "a b", "host|nc", "`id`"]) {
      expect(() => assertSafeHost(h)).toThrow();
    }
  });
});
