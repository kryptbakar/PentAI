import { eq, desc } from "drizzle-orm";
import { db, targetsTable, scansTable } from "@workspace/db";
import { launchScan } from "./scan-runner";
import { logger } from "../lib/logger";

/**
 * Continuous-monitoring scheduler. Periodically re-scans targets that have
 * monitoring enabled and are due (their last scan is older than the configured
 * interval), turning PentAI from a one-shot scanner into ongoing attack-surface
 * monitoring. Re-scans go through the same authorization gate as manual scans.
 *
 * In-process and interval-based (no external cron dependency). For multi-instance
 * deployments this should move to a durable scheduler/queue — see roadmap.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // evaluate every 5 minutes
const DEFAULT_INTERVAL_HOURS = 24;
const MONITOR_TOOL = "nuclei";

async function tick(): Promise<void> {
  const targets = await db
    .select()
    .from(targetsTable)
    .where(eq(targetsTable.monitoringEnabled, true));

  for (const target of targets) {
    const intervalHours = target.monitoringIntervalHours ?? DEFAULT_INTERVAL_HOURS;

    const [last] = await db
      .select()
      .from(scansTable)
      .where(eq(scansTable.targetId, target.id))
      .orderBy(desc(scansTable.createdAt))
      .limit(1);

    // Don't stack scans on top of one still running.
    if (last?.status === "running") continue;

    const lastAt = last?.completedAt ?? last?.createdAt ?? null;
    const dueAt = lastAt ? new Date(lastAt).getTime() + intervalHours * 3_600_000 : 0;
    if (Date.now() < dueAt) continue;

    const result = await launchScan({
      targetId: target.id,
      tool: MONITOR_TOOL,
      phase: "scan",
      operator: "scheduler",
    });
    if (result.ok) {
      logger.info({ targetId: target.id, scanId: result.scan.id }, "Scheduled re-scan launched");
    } else {
      logger.warn({ targetId: target.id, reason: result.reason }, "Scheduled re-scan denied by gate");
    }
  }
}

export function startMonitoringScheduler(): void {
  if (process.env.PENTAI_DISABLE_SCHEDULER === "1") return;
  setInterval(() => {
    void tick().catch((err) => logger.error({ err }, "Monitoring tick failed"));
  }, CHECK_INTERVAL_MS).unref();
  logger.info("Continuous monitoring scheduler started");
}
