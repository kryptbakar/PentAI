import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, scansTable, targetsTable, scopesTable, findingsTable, auditEntriesTable } from "@workspace/db";
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
  const [target] = await db
    .select()
    .from(targetsTable)
    .where(eq(targetsTable.id, parsed.data.targetId));

  if (!target) {
    res.status(403).json({ error: "Target not found or not authorized" });
    return;
  }

  const [scope] = await db.select().from(scopesTable).where(eq(scopesTable.id, target.scopeId));

  const deny = async (reason: string) => {
    await db.insert(auditEntriesTable).values({
      operator: "system",
      targetId: target.id,
      tool: parsed.data.tool,
      flags: reason,
      authorizedBy: null,
      outcome: "denied",
    });
    res.status(403).json({ error: reason });
  };

  // 1. Target must be on the allow-list
  if (!target.allowed) {
    await deny("Target is not on the authorization allow-list");
    return;
  }

  // 2. Scope must have an active RoE record
  if (!scope || !scope.roeActive) {
    await deny("Scope rules-of-engagement are not active");
    return;
  }

  // 3. Scope validity window
  const now = new Date();
  if (scope.validFrom && new Date(scope.validFrom) > now) {
    await deny("Scope engagement has not started yet");
    return;
  }
  if (scope.validUntil && new Date(scope.validUntil) < now) {
    await deny("Scope engagement window has expired");
    return;
  }

  // 4. Exploit phase requires active mode enabled on target
  if (parsed.data.phase === "exploit" && !target.activeModeEnabled) {
    await deny("Active/exploit mode is not enabled for this target");
    return;
  }

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

  // Audit log: allowed
  await db.insert(auditEntriesTable).values({
    operator: "system",
    targetId: target.id,
    tool: parsed.data.tool,
    flags: JSON.stringify(parsed.data.options ?? {}),
    authorizedBy: scope?.signedBy ?? null,
    outcome: "allowed",
  });

  // Simulate scan completion after 3 seconds (for demo)
  setTimeout(async () => {
    await db
      .update(scansTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(scansTable.id, scan.id));

    // Generate mock findings for demo
    const mockFindings = [
      {
        scanId: scan.id,
        targetId: target.id,
        tool: parsed.data.tool,
        severity: "high",
        title: `Open port detected on ${target.host}`,
        description: "A high-risk port is exposed without authentication.",
        evidence: `PORT 22/tcp open ssh\nPORT 80/tcp open http`,
        cveRefs: ["CVE-2023-1234"],
        remediation: "Close unnecessary ports or add firewall rules to restrict access.",
        raw: JSON.stringify({ host: target.host, ports: [22, 80] }),
      },
      {
        scanId: scan.id,
        targetId: target.id,
        tool: parsed.data.tool,
        severity: "medium",
        title: `Missing security headers on ${target.host}`,
        description: "The server response does not include recommended security headers.",
        evidence: `HTTP/1.1 200 OK\nContent-Type: text/html\n(missing X-Frame-Options, CSP)`,
        cveRefs: [],
        remediation: "Add X-Frame-Options, Content-Security-Policy, and HSTS headers.",
        raw: null,
      },
    ];

    for (const f of mockFindings) {
      await db.insert(findingsTable).values(f);
    }
  }, 3000);

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
