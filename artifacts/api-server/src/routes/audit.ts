import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, auditEntriesTable, targetsTable } from "@workspace/db";
import {
  ListAuditEntriesQueryParams,
  ListAuditEntriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/audit", async (req, res): Promise<void> => {
  const qp = ListAuditEntriesQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const conditions = [];
  if (qp.data.targetId) conditions.push(eq(auditEntriesTable.targetId, qp.data.targetId));
  if (qp.data.tool) conditions.push(eq(auditEntriesTable.tool, qp.data.tool as string));

  let query = db
    .select({ entry: auditEntriesTable, host: targetsTable.host })
    .from(auditEntriesTable)
    .leftJoin(targetsTable, eq(auditEntriesTable.targetId, targetsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEntriesTable.createdAt))
    .$dynamic();

  if (qp.data.limit) {
    query = query.limit(qp.data.limit);
  }

  const rows = await query;

  const result = rows.map(({ entry, host }) => ({
    ...entry,
    targetId: entry.targetId ?? null,
    targetHost: host ?? "unknown",
    flags: entry.flags ?? null,
    authorizedBy: entry.authorizedBy ?? null,
    createdAt: entry.createdAt.toISOString(),
  }));

  res.json(ListAuditEntriesResponse.parse(result));
});

export default router;
