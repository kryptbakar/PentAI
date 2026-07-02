import type { Target, InsertFinding } from "@workspace/db";

export type FindingDraft = Omit<InsertFinding, "scanId" | "targetId">;

export interface ToolAdapter {
  name: string;
  phase: "recon" | "scan" | "exploit" | "intel";
  requiresActiveMode: boolean;
  run(target: Target, options: Record<string, unknown> | null): Promise<FindingDraft[]>;
}
