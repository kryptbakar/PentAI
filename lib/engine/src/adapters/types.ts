/**
 * Engine-local types — deliberately free of any database dependency so the
 * scanning core can run in the API server, the CLI, or anywhere else.
 */

export interface ScanTarget {
  host: string;
  ip?: string | null;
  portRange?: string | null;
  activeModeEnabled?: boolean;
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface FindingDraft {
  tool: string;
  severity: string; // one of Severity
  title: string;
  description?: string | null;
  evidence?: string | null;
  cveRefs?: string[] | null;
  remediation?: string | null;
  raw?: string | null;
}

export interface ToolAdapter {
  name: string;
  phase: "recon" | "scan" | "exploit" | "intel";
  requiresActiveMode: boolean;
  run(target: ScanTarget, options: Record<string, unknown> | null): Promise<FindingDraft[]>;
}
