import { assertSafeHost, runDockerTool } from "../dispatcher";
import type { ToolAdapter, FindingDraft } from "./types";

export const subfinderAdapter: ToolAdapter = {
  name: "subfinder",
  phase: "recon",
  requiresActiveMode: false,
  requiresDocker: true,

  async run(target): Promise<FindingDraft[]> {
    const host = assertSafeHost(target.host);

    const { stdout } = await runDockerTool({
      image: "projectdiscovery/subfinder",
      args: ["-silent", "-d", host],
      timeoutMs: 120_000,
    });

    const subdomains = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return subdomains.map((subdomain) => ({
      tool: "subfinder",
      severity: "info",
      title: `Subdomain discovered: ${subdomain}`,
      description: `Passive enumeration found ${subdomain} as part of ${target.host}'s attack surface.`,
      evidence: subdomain,
      cveRefs: [],
      remediation: "Confirm this subdomain is intentionally public; decommission or restrict unused subdomains.",
      raw: null,
    }));
  },
};
