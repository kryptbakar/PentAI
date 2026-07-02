import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, scansTable, targetsTable, scopesTable, findingsTable, type Target } from "@workspace/db";
import { authorizeTarget } from "../services/authorization";
import { adapterRegistry } from "../adapters/registry";
import type { ToolAdapter } from "../adapters/types";
import {
  CreateScanBody,
  CreateScanResponse,
  GetScanParams,
  GetScanResponse,
  CancelScanParams,
  CancelScanResponse,
  GetScanFindingsParams,
  GetScanFindingsResponse,
  ListScansQueryParams,
  ListScansResponse,
  GetActiveScansResponse,
} from "@workspace/api-zod";
import { count } from "drizzle-orm";

const router: IRouter = Router();

async function enrichScan(scan: typeof scansTable.$inferSelect) {
  const [row] = await db
    .select({ host: targetsTable.host, scopeName: scopesTable.name })
    .from(targetsTable)
    .leftJoin(scopesTable, eq(targetsTable.scopeId, scopesTable.id))
    .where(eq(targetsTable.id, scan.targetId));

  const [{ fc }] = await db
    .select({ fc: count() })
    .from(findingsTable)
    .where(eq(findingsTable.scanId, scan.id));

  return {
    ...scan,
    targetHost: row?.host ?? "",
    scopeName: row?.scopeName ?? "",
    startedAt: scan.startedAt?.toISOString() ?? null,
    completedAt: scan.completedAt?.toISOString() ?? null,
    errorMessage: scan.errorMessage ?? null,
    findingCount: Number(fc),
    createdAt: scan.createdAt.toISOString(),
  };
}

async function executeScan(
  scanId: number,
  target: Target,
  adapter: ToolAdapter,
  options: Record<string, unknown> | null
): Promise<void> {
  try {
    const findings = await adapter.run(target, options);

    for (const finding of findings) {
      await db.insert(findingsTable).values({ ...finding, scanId, targetId: target.id });
    }

    await db
      .update(scansTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(scansTable.id, scanId));
  } catch (error) {
    await db
      .update(scansTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(scansTable.id, scanId));
  }
}

router.get("/scans/active", async (_req, res): Promise<void> => {
  const scans = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.status, "running"))
    .orderBy(scansTable.createdAt);

  const result = await Promise.all(scans.map(enrichScan));
  res.json(GetActiveScansResponse.parse(result));
});

router.get("/scans", async (req, res): Promise<void> => {
  const qp = ListScansQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const conditions = [];
  if (qp.data.targetId) conditions.push(eq(scansTable.targetId, qp.data.targetId));
  if (qp.data.status) conditions.push(eq(scansTable.status, qp.data.status as string));

  let scans;
  if (qp.data.scopeId) {
    // Join through targets to filter by scope
    const targetIds = await db
      .select({ id: targetsTable.id })
      .from(targetsTable)
      .where(eq(targetsTable.scopeId, qp.data.scopeId));
    const ids = targetIds.map((t) => t.id);
    if (ids.length === 0) {
      res.json(ListScansResponse.parse([]));
      return;
    }
    const { inArray } = await import("drizzle-orm");
    conditions.push(inArray(scansTable.targetId, ids));
  }

  let query = db.select().from(scansTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  scans = await query.orderBy(scansTable.createdAt);
  const result = await Promise.all(scans.map(enrichScan));
  res.json(ListScansResponse.parse(result));
});

router.post("/scans", async (req, res): Promise<void> => {
  const parsed = CreateScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Authorization gate — hard chokepoint
  const auth = await authorizeTarget(
    parsed.data.targetId,
    parsed.data.phase,
    parsed.data.tool,
    JSON.stringify(parsed.data.options ?? {})
  );

  if (!auth.ok) {
    res.status(403).json({ error: auth.reason });
    return;
  }

  const { target, scope } = auth;

  const [scan] = await db
    .insert(scansTable)
    .values({
      targetId: parsed.data.targetId,
      tool: parsed.data.tool,
      phase: parsed.data.phase,
      status: "running",
      startedAt: new Date(),
      options: parsed.data.options ?? null,
    })
    .returning();

  const adapter = adapterRegistry.get(parsed.data.tool);
  if (!adapter) {
    await db
      .update(scansTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: `Tool '${parsed.data.tool}' is not yet implemented`,
      })
      .where(eq(scansTable.id, scan.id));
  } else {
    void executeScan(scan.id, target, adapter, (parsed.data.options as Record<string, unknown> | null) ?? null);
  }

  res.status(201).json(
    CreateScanResponse.parse({
      ...scan,
      targetHost: target.host,
      scopeName: scope?.name ?? "",
      startedAt: scan.startedAt?.toISOString() ?? null,
      completedAt: null,
      errorMessage: null,
      findingCount: 0,
      createdAt: scan.createdAt.toISOString(),
    })
  );
});

router.get("/scans/:id", async (req, res): Promise<void> => {
  const params = GetScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, params.data.id));
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  const enriched = await enrichScan(scan);
  res.json(GetScanResponse.parse(enriched));
});

router.post("/scans/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [scan] = await db
    .update(scansTable)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(scansTable.id, params.data.id))
    .returning();

  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  const enriched = await enrichScan(scan);
  res.json(CancelScanResponse.parse(enriched));
});

router.get("/scans/:id/findings", async (req, res): Promise<void> => {
  const params = GetScanFindingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const findings = await db
    .select({ finding: findingsTable, host: targetsTable.host })
    .from(findingsTable)
    .leftJoin(targetsTable, eq(findingsTable.targetId, targetsTable.id))
    .where(eq(findingsTable.scanId, params.data.id))
    .orderBy(findingsTable.createdAt);

  const result = findings.map(({ finding, host }) => ({
    ...finding,
    targetHost: host ?? "",
    cveRefs: finding.cveRefs ?? [],
    description: finding.description ?? null,
    evidence: finding.evidence ?? null,
    remediation: finding.remediation ?? null,
    raw: finding.raw ?? null,
    createdAt: finding.createdAt.toISOString(),
  }));

  res.json(GetScanFindingsResponse.parse(result));
});

export default router;
