import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, reportsTable, scansTable, targetsTable, findingsTable } from "@workspace/db";
import {
  GenerateReportBody,
  GenerateReportResponse,
  GetReportParams,
  GetReportResponse,
  ListReportsResponse,
} from "@workspace/api-zod";
import { count } from "drizzle-orm";

const router: IRouter = Router();

async function enrichReport(report: typeof reportsTable.$inferSelect) {
  const [row] = await db
    .select({ host: targetsTable.host })
    .from(scansTable)
    .leftJoin(targetsTable, eq(scansTable.targetId, targetsTable.id))
    .where(eq(scansTable.id, report.scanId));

  return {
    ...report,
    targetHost: row?.host ?? "",
    summary: report.summary ?? null,
    findingCount: report.findingCount,
    generatedAt: report.generatedAt.toISOString(),
  };
}

router.get("/reports", async (_req, res): Promise<void> => {
  const reports = await db.select().from(reportsTable).orderBy(reportsTable.generatedAt);
  const result = await Promise.all(reports.map(enrichReport));
  res.json(ListReportsResponse.parse(result));
});

router.post("/reports", async (req, res): Promise<void> => {
  const parsed = GenerateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, parsed.data.scanId));
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  const [{ fc }] = await db
    .select({ fc: count() })
    .from(findingsTable)
    .where(eq(findingsTable.scanId, scan.id));

  const [target] = await db.select().from(targetsTable).where(eq(targetsTable.id, scan.targetId));

  const findings = await db
    .select()
    .from(findingsTable)
    .where(eq(findingsTable.scanId, scan.id));

  const summaryLines = [
    `Scan: ${scan.tool} on ${target?.host ?? "unknown"} (${scan.phase})`,
    `Status: ${scan.status}`,
    `Findings: ${fc} total`,
    ...findings.map((f) => `[${f.severity.toUpperCase()}] ${f.title}`),
  ];

  const [report] = await db
    .insert(reportsTable)
    .values({
      scanId: parsed.data.scanId,
      format: parsed.data.format,
      summary: summaryLines.join("\n"),
      findingCount: Number(fc),
      content: parsed.data.format === "json" ? JSON.stringify({ scan, findings }, null, 2) : summaryLines.join("\n"),
    })
    .returning();

  const enriched = await enrichReport(report);
  res.status(201).json(GenerateReportResponse.parse(enriched));
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, params.data.id));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const enriched = await enrichReport(report);
  res.json(GetReportResponse.parse(enriched));
});

export default router;
