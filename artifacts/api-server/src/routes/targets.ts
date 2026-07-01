import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, targetsTable, scopesTable } from "@workspace/db";
import {
  CreateTargetBody,
  CreateTargetResponse,
  GetTargetParams,
  GetTargetResponse,
  UpdateTargetParams,
  UpdateTargetBody,
  UpdateTargetResponse,
  DeleteTargetParams,
  ListTargetsQueryParams,
  ListTargetsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatTarget(target: typeof targetsTable.$inferSelect, scopeName?: string) {
  return {
    ...target,
    scopeName: scopeName ?? "",
    ip: target.ip ?? null,
    portRange: target.portRange ?? null,
    notes: target.notes ?? null,
    createdAt: target.createdAt.toISOString(),
  };
}

router.get("/targets", async (req, res): Promise<void> => {
  const qp = ListTargetsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const rows = await db
    .select({
      target: targetsTable,
      scopeName: scopesTable.name,
    })
    .from(targetsTable)
    .leftJoin(scopesTable, eq(targetsTable.scopeId, scopesTable.id))
    .where(qp.data.scopeId ? eq(targetsTable.scopeId, qp.data.scopeId) : undefined)
    .orderBy(targetsTable.createdAt);

  const result = rows.map(({ target, scopeName }) => formatTarget(target, scopeName ?? ""));
  res.json(ListTargetsResponse.parse(result));
});

router.post("/targets", async (req, res): Promise<void> => {
  const parsed = CreateTargetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db.insert(targetsTable).values(parsed.data).returning();

  const [scope] = await db.select().from(scopesTable).where(eq(scopesTable.id, target.scopeId));

  res.status(201).json(CreateTargetResponse.parse(formatTarget(target, scope?.name ?? "")));
});

router.get("/targets/:id", async (req, res): Promise<void> => {
  const params = GetTargetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ target: targetsTable, scopeName: scopesTable.name })
    .from(targetsTable)
    .leftJoin(scopesTable, eq(targetsTable.scopeId, scopesTable.id))
    .where(eq(targetsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Target not found" });
    return;
  }

  res.json(GetTargetResponse.parse(formatTarget(row.target, row.scopeName ?? "")));
});

router.patch("/targets/:id", async (req, res): Promise<void> => {
  const params = UpdateTargetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTargetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .update(targetsTable)
    .set(parsed.data)
    .where(eq(targetsTable.id, params.data.id))
    .returning();

  if (!target) {
    res.status(404).json({ error: "Target not found" });
    return;
  }

  const [scope] = await db.select().from(scopesTable).where(eq(scopesTable.id, target.scopeId));
  res.json(UpdateTargetResponse.parse(formatTarget(target, scope?.name ?? "")));
});

router.delete("/targets/:id", async (req, res): Promise<void> => {
  const params = DeleteTargetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [target] = await db.delete(targetsTable).where(eq(targetsTable.id, params.data.id)).returning();
  if (!target) {
    res.status(404).json({ error: "Target not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
