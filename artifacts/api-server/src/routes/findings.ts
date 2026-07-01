import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, findingsTable, targetsTable } from "@workspace/db";
import {
  GetFindingParams,
  GetFindingResponse,
  GetFindingsBySeverityResponse,
  ListFindingsQueryParams,
  ListFindingsResponse,
} from "@workspace/api-zod";
import { count } from "drizzle-orm";

const router: IRouter = Router();

function formatFinding(finding: typeof findingsTable.$inferSelect, host: string) {
  return {
    ...finding,
    targetHost: host,
    cveRefs: finding.cveRefs ?? [],
    description: finding.description ?? null,
    evidence: finding.evidence ?? null,
    remediation: finding.remediation ?? null,
    raw: finding.raw ?? null,
    createdAt: finding.createdAt.toISOString(),
  };
}

router.get("/findings/by-severity", async (_req, res): Promise<void> => {
  const severities = ["critical", "high", "medium", "low", "info"];
  const counts = await db
    .select({ severity: findingsTable.severity, count: count() })
    .from(findingsTable)
    .groupBy(findingsTable.severity);

  const map = new Map(counts.map((r) => [r.severity, Number(r.count)]));
  const result: Record<string, number> = {};
  for (const s of severities) result[s] = map.get(s) ?? 0;

  res.json(GetFindingsBySeverityResponse.parse(result));
});

router.get("/findings", async (req, res): Promise<void> => {
  const qp = ListFindingsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const conditions = [];
  if (qp.data.severity) conditions.push(eq(findingsTable.severity, qp.data.severity as string));
  if (qp.data.targetId) conditions.push(eq(findingsTable.targetId, qp.data.targetId));
  if (qp.data.tool) conditions.push(eq(findingsTable.tool, qp.data.tool as string));

  // scopeId filter: join through targets
  if (qp.data.scopeId) {
    const { inArray } = await import("drizzle-orm");
    const targetIds = await db
      .select({ id: targetsTable.id })
      .from(targetsTable)
      .where(eq(targetsTable.scopeId, qp.data.scopeId));
    const ids = targetIds.map((t) => t.id);
    if (ids.length === 0) {
      res.json(ListFindingsResponse.parse([]));
      return;
    }
    conditions.push(inArray(findingsTable.targetId, ids));
  }

  const rows = await db
    .select({ finding: findingsTable, host: targetsTable.host })
    .from(findingsTable)
    .leftJoin(targetsTable, eq(findingsTable.targetId, targetsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(findingsTable.createdAt);

  const result = rows.map(({ finding, host }) => formatFinding(finding, host ?? ""));
  res.json(ListFindingsResponse.parse(result));
});

router.get("/findings/:id", async (req, res): Promise<void> => {
  const params = GetFindingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ finding: findingsTable, host: targetsTable.host })
    .from(findingsTable)
    .leftJoin(targetsTable, eq(findingsTable.targetId, targetsTable.id))
    .where(eq(findingsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Finding not found" });
    return;
  }

  res.json(GetFindingResponse.parse(formatFinding(row.finding, row.host ?? "")));
});

export default router;
