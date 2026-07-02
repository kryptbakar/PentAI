import { adapterRegistry } from "./adapters/registry";
import { assertPublicHost } from "./net-guard";
import type { FindingDraft, ScanTarget } from "./adapters/types";

/**
 * High-level assessment runner used by the CLI (and available to the API).
 * Applies the SSRF/internal-target guard, then runs a toolchain of adapters
 * against a host, streaming progress through an optional callback.
 */

/** Default non-intrusive toolchain: passive recon + safe vulnerability checks. */
export const DEFAULT_TOOLCHAIN = ["subfinder", "httpx", "nmap", "headers", "nuclei"];

export type AssessmentEvent =
  | { type: "start"; tool: string }
  | { type: "finding"; tool: string; finding: FindingDraft }
  | { type: "done"; tool: string; count: number }
  | { type: "skip"; tool: string; reason: string }
  | { type: "error"; tool: string; message: string };

export interface RunAssessmentOptions {
  tools?: string[];
  activeMode?: boolean;
  portRange?: string | null;
  onEvent?: (event: AssessmentEvent) => void;
}

export interface AssessmentResult {
  host: string;
  findings: FindingDraft[];
}

/** List the tools that are actually available in the registry. */
export function availableTools(): { name: string; phase: string; requiresActiveMode: boolean }[] {
  return [...adapterRegistry.values()].map((a) => ({
    name: a.name,
    phase: a.phase,
    requiresActiveMode: a.requiresActiveMode,
  }));
}

export async function runAssessment(
  host: string,
  options: RunAssessmentOptions = {},
): Promise<AssessmentResult> {
  const tools = options.tools?.length ? options.tools : DEFAULT_TOOLCHAIN;
  const activeMode = options.activeMode ?? false;

  // Hard safety gate: refuse loopback / private / metadata targets.
  await assertPublicHost(host);

  const target: ScanTarget = {
    host,
    portRange: options.portRange ?? null,
    activeModeEnabled: activeMode,
  };

  const all: FindingDraft[] = [];

  for (const name of tools) {
    const adapter = adapterRegistry.get(name);
    if (!adapter) {
      options.onEvent?.({ type: "skip", tool: name, reason: "unknown tool" });
      continue;
    }
    if (adapter.requiresActiveMode && !activeMode) {
      options.onEvent?.({ type: "skip", tool: name, reason: "requires --active mode" });
      continue;
    }

    options.onEvent?.({ type: "start", tool: name });
    try {
      const findings = await adapter.run(target, null);
      for (const finding of findings) {
        options.onEvent?.({ type: "finding", tool: name, finding });
      }
      all.push(...findings);
      options.onEvent?.({ type: "done", tool: name, count: findings.length });
    } catch (err) {
      options.onEvent?.({
        type: "error",
        tool: name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { host, findings: all };
}
