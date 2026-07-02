import { assertSafeHost, runDockerTool } from "../dispatcher";
import type { ToolAdapter, FindingDraft } from "./types";

interface NucleiMatch {
  "template-id"?: string;
  info?: {
    name?: string;
    severity?: string;
    description?: string;
    remediation?: string;
    classification?: { "cve-id"?: string[] };
  };
  "matched-at"?: string;
}

const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

export const nucleiAdapter: ToolAdapter = {
  name: "nuclei",
  phase: "scan",
  requiresActiveMode: false,

  async run(target): Promise<FindingDraft[]> {
    const host = assertSafeHost(target.host);

    // Safe-mode default: exclude intrusive/dos/fuzz templates unconditionally in Phase 1.
    const { stdout } = await runDockerTool({
      image: "projectdiscovery/nuclei",
      args: ["-target", host, "-jsonl", "-silent", "-etags", "dos,intrusive,fuzz"],
      timeoutMs: 300_000,
      volumes: ["sentinel-nuclei-templates:/root/nuclei-templates"],
      // Nuclei's Go runtime needs more headroom than the 512m default,
      // especially while compiling the full template set on a cold cache —
      // observed as a SIGBUS crash under the default limit.
      memoryLimit: "2g",
    });

    const findings: FindingDraft[] = [];

    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let match: NucleiMatch;
      try {
        match = JSON.parse(trimmed) as NucleiMatch;
      } catch {
        continue;
      }

      const info = match.info ?? {};
      const severity = VALID_SEVERITIES.has(info.severity ?? "") ? info.severity! : "info";

      findings.push({
        tool: "nuclei",
        severity,
        title: info.name ?? match["template-id"] ?? "Nuclei finding",
        description: info.description ?? null,
        evidence: match["matched-at"] ?? host,
        cveRefs: info.classification?.["cve-id"] ?? [],
        remediation: info.remediation ?? null,
        raw: JSON.stringify(match),
      });
    }

    return findings;
  },
};
