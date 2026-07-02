import { XMLParser } from "fast-xml-parser";
import { assertSafeHost, runDockerTool } from "../dispatcher";
import type { ToolAdapter, FindingDraft } from "./types";

const RISKY_PORTS = new Set([21, 23, 445, 3389, 3306, 5432, 6379, 27017]);

interface NmapPort {
  "@_portid": string;
  "@_protocol": string;
  state: { "@_state": string };
  service?: { "@_name"?: string; "@_product"?: string; "@_version"?: string };
}

export const nmapAdapter: ToolAdapter = {
  name: "nmap",
  phase: "recon",
  requiresActiveMode: false,
  requiresDocker: true,

  async run(target, options): Promise<FindingDraft[]> {
    const host = assertSafeHost(target.host);
    const portArgs = target.portRange ? ["-p", target.portRange] : ["--top-ports", "1000"];

    const { stdout } = await runDockerTool({
      image: "instrumentisto/nmap",
      args: ["-Pn", "-sV", "-T4", "-oX", "-", ...portArgs, host],
      timeoutMs: 120_000,
    });

    const parsed = new XMLParser({ ignoreAttributes: false });
    const doc = parsed.parse(stdout);
    const hostEntry = doc?.nmaprun?.host;
    if (!hostEntry) {
      return [];
    }

    const rawPorts = hostEntry.ports?.port;
    const ports: NmapPort[] = Array.isArray(rawPorts) ? rawPorts : rawPorts ? [rawPorts] : [];

    const findings: FindingDraft[] = [];
    for (const port of ports) {
      if (port.state?.["@_state"] !== "open") continue;

      const portId = Number(port["@_portid"]);
      const proto = port["@_protocol"];
      const service = port.service?.["@_name"] ?? "unknown";
      const product = [port.service?.["@_product"], port.service?.["@_version"]].filter(Boolean).join(" ");
      const severity = RISKY_PORTS.has(portId) ? "medium" : "info";

      findings.push({
        tool: "nmap",
        severity,
        title: `Open port ${portId}/${proto} (${service}) on ${target.host}`,
        description: product
          ? `Service detected: ${product}`
          : `Port ${portId}/${proto} is open and running ${service}.`,
        evidence: `PORT ${portId}/${proto} open ${service}${product ? ` (${product})` : ""}`,
        cveRefs: [],
        remediation:
          severity === "medium"
            ? "Restrict access to this port via firewall rules or disable the service if not required."
            : "Confirm this service is intentionally exposed; close it if not required.",
        raw: JSON.stringify({ host: target.host, port: portId, protocol: proto, service, options }),
      });
    }

    return findings;
  },
};
