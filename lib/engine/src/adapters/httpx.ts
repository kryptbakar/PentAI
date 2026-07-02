import { assertSafeHost, runDockerTool } from "../dispatcher";
import type { ToolAdapter, FindingDraft } from "./types";

interface HttpxResult {
  url?: string;
  status_code?: number;
  title?: string;
  webserver?: string;
  tech?: string[];
  // httpx's -irh flag returns headers as an object with underscored keys
  // (e.g. "x_frame_options"), not a raw header string.
  header?: Record<string, string>;
}

const SECURITY_HEADERS = ["content_security_policy", "x_frame_options", "strict_transport_security"];

export const httpxAdapter: ToolAdapter = {
  name: "httpx",
  phase: "recon",
  requiresActiveMode: false,
  requiresDocker: true,

  async run(target): Promise<FindingDraft[]> {
    const host = assertSafeHost(target.host);

    const { stdout } = await runDockerTool({
      image: "projectdiscovery/httpx",
      args: ["-silent", "-json", "-irh", "-u", host],
      timeoutMs: 60_000,
    });

    const findings: FindingDraft[] = [];

    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let result: HttpxResult;
      try {
        result = JSON.parse(trimmed) as HttpxResult;
      } catch {
        continue;
      }

      const url = result.url ?? target.host;
      const headerKeys = new Set(Object.keys(result.header ?? {}));

      findings.push({
        tool: "httpx",
        severity: "info",
        title: `HTTP service on ${url}`,
        description: [
          result.title ? `Title: ${result.title}` : null,
          result.webserver ? `Server: ${result.webserver}` : null,
          result.tech?.length ? `Tech: ${result.tech.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" | ") || `Status ${result.status_code ?? "unknown"}`,
        evidence: `HTTP ${result.status_code ?? ""} ${url}`,
        cveRefs: [],
        remediation: "Confirm this service is intentionally exposed.",
        raw: JSON.stringify(result),
      });

      const missingHeaders = SECURITY_HEADERS.filter((h) => !headerKeys.has(h));
      if (missingHeaders.length > 0) {
        findings.push({
          tool: "httpx",
          severity: "medium",
          title: `Missing security headers on ${url}`,
          description: "The server response does not include recommended security headers.",
          evidence: `Missing: ${missingHeaders.join(", ").replace(/_/g, "-")}`,
          cveRefs: [],
          remediation: "Add Content-Security-Policy, X-Frame-Options, and Strict-Transport-Security headers.",
          raw: result.header ? JSON.stringify(result.header) : null,
        });
      }
    }

    return findings;
  },
};
