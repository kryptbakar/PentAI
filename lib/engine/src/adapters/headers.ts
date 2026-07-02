import { assertSafeHost } from "../dispatcher";
import { assertPublicHost } from "../net-guard";
import type { ToolAdapter, FindingDraft } from "./types";

/**
 * Passive HTTP security-header analyzer. Runs in-process (no Docker) — fetches
 * the target over HTTPS and flags missing or weak security headers and cookie
 * flags. Non-intrusive: a single GET, safe-mode by default.
 */

type Severity = "high" | "medium" | "low" | "info";

interface HeaderRule {
  header: string;
  severity: Severity;
  title: string;
  description: string;
  remediation: string;
}

const REQUIRED_HEADERS: HeaderRule[] = [
  {
    header: "strict-transport-security",
    severity: "medium",
    title: "Missing HTTP Strict Transport Security (HSTS)",
    description: "The response has no Strict-Transport-Security header, so browsers may downgrade to HTTP and are exposed to SSL-stripping.",
    remediation: "Send `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.",
  },
  {
    header: "content-security-policy",
    severity: "medium",
    title: "Missing Content-Security-Policy (CSP)",
    description: "No CSP header was set, removing a key defense against cross-site scripting and data injection.",
    remediation: "Define a restrictive Content-Security-Policy, starting from `default-src 'self'` and tightening from there.",
  },
  {
    header: "x-content-type-options",
    severity: "low",
    title: "Missing X-Content-Type-Options",
    description: "Without `X-Content-Type-Options: nosniff`, browsers may MIME-sniff responses, enabling some XSS vectors.",
    remediation: "Send `X-Content-Type-Options: nosniff`.",
  },
  {
    header: "x-frame-options",
    severity: "low",
    title: "Missing X-Frame-Options / frame-ancestors",
    description: "No clickjacking protection was found (X-Frame-Options or CSP frame-ancestors).",
    remediation: "Send `X-Frame-Options: DENY` or a CSP `frame-ancestors 'none'` directive.",
  },
  {
    header: "referrer-policy",
    severity: "info",
    title: "Missing Referrer-Policy",
    description: "No Referrer-Policy header; the full URL may leak to third parties in the Referer header.",
    remediation: "Send `Referrer-Policy: strict-origin-when-cross-origin` (or stricter).",
  },
];

/**
 * Pure evaluation of a response's headers into findings. Kept separate from the
 * network fetch so it can be unit-tested without hitting the wire.
 */
export function evaluateSecurityHeaders(
  headers: Record<string, string | undefined>,
  evidenceHost: string,
): FindingDraft[] {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) lower[k.toLowerCase()] = v;
  }

  const findings: FindingDraft[] = [];

  for (const rule of REQUIRED_HEADERS) {
    const present =
      lower[rule.header] !== undefined ||
      // X-Frame-Options is also satisfied by a CSP frame-ancestors directive.
      (rule.header === "x-frame-options" && /frame-ancestors/i.test(lower["content-security-policy"] ?? ""));
    if (!present) {
      findings.push({
        tool: "headers",
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        evidence: evidenceHost,
        cveRefs: [],
        remediation: rule.remediation,
        raw: null,
      });
    }
  }

  // Cookie flag hygiene.
  const setCookie = lower["set-cookie"];
  if (setCookie) {
    if (!/;\s*secure/i.test(setCookie)) {
      findings.push({
        tool: "headers",
        severity: "medium",
        title: "Cookie without Secure flag",
        description: "A Set-Cookie response did not include the Secure attribute, so the cookie can be sent over plaintext HTTP.",
        evidence: evidenceHost,
        cveRefs: [],
        remediation: "Add the `Secure` attribute to all cookies.",
        raw: null,
      });
    }
    if (!/;\s*httponly/i.test(setCookie)) {
      findings.push({
        tool: "headers",
        severity: "low",
        title: "Cookie without HttpOnly flag",
        description: "A Set-Cookie response did not include HttpOnly, exposing the cookie to client-side script (XSS token theft).",
        evidence: evidenceHost,
        cveRefs: [],
        remediation: "Add the `HttpOnly` attribute to session cookies.",
        raw: null,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      tool: "headers",
      severity: "info",
      title: "Security headers present",
      description: "All checked security headers were present on the response.",
      evidence: evidenceHost,
      cveRefs: [],
      remediation: null,
      raw: null,
    });
  }

  return findings;
}

export const headersAdapter: ToolAdapter = {
  name: "headers",
  phase: "scan",
  requiresActiveMode: false,
  requiresDocker: false,

  async run(target): Promise<FindingDraft[]> {
    const host = assertSafeHost(target.host);
    await assertPublicHost(host);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`https://${host}/`, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "PentAI-HeaderScanner/1.0" },
      });

      const headers: Record<string, string | undefined> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return evaluateSecurityHeaders(headers, host);
    } finally {
      clearTimeout(timeout);
    }
  },
};
