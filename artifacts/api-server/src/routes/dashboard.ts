import { Router, type IRouter } from "express";
import { eq, gte, desc } from "drizzle-orm";
import { db, scopesTable, targetsTable, scansTable, findingsTable, auditEntriesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
} from "@workspace/api-zod";
import { count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [[{ totalScopes }], [{ totalTargets }], [{ totalScans }], [{ activeScans }], severityCounts] =
    await Promise.all([
      db.select({ totalScopes: count() }).from(scopesTable),
      db.select({ totalTargets: count() }).from(targetsTable),
      db.select({ totalScans: count() }).from(scansTable),
      db
        .select({ activeScans: count() })
        .from(scansTable)
        .where(eq(scansTable.status, "running")),
      db
        .select({ severity: findingsTable.severity, c: count() })
        .from(findingsTable)
        .groupBy(findingsTable.severity),
    ]);

  const severityMap = new Map(severityCounts.map((r) => [r.severity, Number(r.c)]));

  // Last 7 days findings by day
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentFindings = await db
    .select()
    .from(findingsTable)
    .where(gte(findingsTable.createdAt, sevenDaysAgo));

  const dayMap = new Map<string, number>();
  for (const f of recentFindings) {
    const day = f.createdAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const recentFindingsByDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  res.json(
    GetDashboardSummaryResponse.parse({
      totalScopes: Number(totalScopes),
      totalTargets: Number(totalTargets),
      totalScans: Number(totalScans),
      activeScans: Number(activeScans),
      totalFindings: Array.from(severityMap.values()).reduce((a, b) => a + b, 0),
      criticalFindings: severityMap.get("critical") ?? 0,
      highFindings: severityMap.get("high") ?? 0,
      recentFindingsByDay,
    })
  );
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const qp = GetRecentActivityQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const limit = qp.data.limit ?? 20;

  // Recent scans
  const recentScans = await db
    .select({ scan: scansTable, host: targetsTable.host })
    .from(scansTable)
    .leftJoin(targetsTable, eq(scansTable.targetId, targetsTable.id))
    .orderBy(desc(scansTable.createdAt))
    .limit(limit);

  // Recent critical/high findings
  const recentFindings = await db
    .select({ finding: findingsTable, host: targetsTable.host })
    .from(findingsTable)
    .leftJoin(targetsTable, eq(findingsTable.targetId, targetsTable.id))
    .where(eq(findingsTable.severity, "critical"))
    .orderBy(desc(findingsTable.createdAt))
    .limit(5);

  const items = [
    ...recentScans.map(({ scan, host }) => {
      const typeMap: Record<string, string> = {
        completed: "scan_completed",
        failed: "scan_failed",
        running: "scan_started",
        cancelled: "scan_cancelled",
        queued: "scan_started",
      };
      return {
        id: `scan-${scan.id}`,
        type: typeMap[scan.status] ?? "scan_started",
        title: `${scan.tool} on ${host ?? "unknown"}`,
        description: `${scan.phase} scan — ${scan.status}`,
        severity: null,
        targetHost: host ?? null,
        createdAt: scan.createdAt.toISOString(),
      };
    }),
    ...recentFindings.map(({ finding, host }) => ({
      id: `finding-${finding.id}`,
      type: finding.severity === "critical" ? "finding_critical" : "finding_high",
      title: finding.title,
      description: finding.description ?? `${finding.severity} severity finding`,
      severity: finding.severity,
      targetHost: host ?? null,
      createdAt: finding.createdAt.toISOString(),
    })),
  ];

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json(GetRecentActivityResponse.parse(items.slice(0, limit)));
});

export default router;
