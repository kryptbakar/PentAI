import { eq } from "drizzle-orm";
import { db, scansTable, findingsTable, type Target, type Scope } from "@workspace/db";
import { authorizeTarget } from "./authorization";
import { adapterRegistry } from "../adapters/registry";
import type { ToolAdapter } from "../adapters/types";
import { emitScanEvent } from "./scan-events";
import { alertOnFindings } from "./alerts";

/**
 * Shared scan execution + launch logic, used by both the POST /scans route and
 * the continuous-monitoring scheduler so the authorization gate and execution
 * path are never re-implemented.
 */

export async function executeScan(
  scanId: number,
  target: Target,
  adapter: ToolAdapter,
  options: Record<string, unknown> | null,
): Promise<void> {
  try {
    emitScanEvent({ type: "log", scanId, message: `Running ${adapter.name}…`, at: new Date().toISOString() });
    const findings = await adapter.run(target, options);

    for (const finding of findings) {
      await db.insert(findingsTable).values({ ...finding, scanId, targetId: target.id });
      emitScanEvent({
        type: "finding",
        scanId,
        severity: finding.severity,
        title: finding.title,
        tool: finding.tool,
        at: new Date().toISOString(),
      });
    }

    await db
      .update(scansTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(scansTable.id, scanId));
    emitScanEvent({ type: "status", scanId, status: "completed", at: new Date().toISOString() });

    void alertOnFindings({
      host: target.host,
      scanId,
      findings: findings.map((f) => ({ severity: f.severity, title: f.title })),
    });
  } catch (error) {
    await db
      .update(scansTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(scansTable.id, scanId));
    emitScanEvent({ type: "status", scanId, status: "failed", at: new Date().toISOString() });
  }
}

export type LaunchResult =
  | { ok: true; scan: typeof scansTable.$inferSelect; target: Target; scope: Scope | undefined }
  | { ok: false; reason: string };

/**
 * Authorize, create, and kick off a scan. Returns the created scan on success or
 * the denial reason. Scan execution runs in the background (fire-and-forget).
 */
export async function launchScan(input: {
  targetId: number;
  tool: string;
  phase: "recon" | "scan" | "exploit" | "intel";
  options?: Record<string, unknown> | null;
  operator?: string;
}): Promise<LaunchResult> {
  const auth = await authorizeTarget(
    input.targetId,
    input.phase,
    input.tool,
    JSON.stringify(input.options ?? {}),
    input.operator ?? "system",
  );
  if (!auth.ok) return { ok: false, reason: auth.reason };

  const { target, scope } = auth;

  const [scan] = await db
    .insert(scansTable)
    .values({
      targetId: input.targetId,
      tool: input.tool,
      phase: input.phase,
      status: "running",
      startedAt: new Date(),
      options: input.options ?? null,
    })
    .returning();

  const adapter = adapterRegistry.get(input.tool);
  if (!adapter) {
    await db
      .update(scansTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: `Tool '${input.tool}' is not yet implemented`,
      })
      .where(eq(scansTable.id, scan.id));
  } else {
    void executeScan(scan.id, target, adapter, input.options ?? null);
  }

  return { ok: true, scan, target, scope };
}
