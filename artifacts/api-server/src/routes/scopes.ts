import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, scopesTable, targetsTable } from "@workspace/db";
import {
  CreateScopeBody,
  CreateScopeResponse,
  GetScopeParams,
  GetScopeResponse,
  UpdateScopeParams,
  UpdateScopeBody,
  UpdateScopeResponse,
  DeleteScopeParams,
  ListScopesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/scopes", async (req, res): Promise<void> => {
  const scopes = await db.select().from(scopesTable).orderBy(scopesTable.createdAt);

  // Attach target counts
  const targetCounts = await db
    .select({ scopeId: targetsTable.scopeId, count: count() })
    .from(targetsTable)
    .groupBy(targetsTable.scopeId);

  const countMap = new Map(targetCounts.map((r) => [r.scopeId, Number(r.count)]));

  const result = scopes.map((s) => ({
    ...s,
    validFrom: s.validFrom ?? null,
    validUntil: s.validUntil ?? null,
    description: s.description ?? null,
    targetCount: countMap.get(s.id) ?? 0,
    createdAt: s.createdAt.toISOString(),
  }));

  res.json(ListScopesResponse.parse(result));
});

router.post("/scopes", async (req, res): Promise<void> => {
  const parsed = CreateScopeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [scope] = await db.insert(scopesTable).values(parsed.data).returning();

  res.status(201).json(
    CreateScopeResponse.parse({
      ...scope,
      validFrom: scope.validFrom ?? null,
      validUntil: scope.validUntil ?? null,
      description: scope.description ?? null,
      targetCount: 0,
      createdAt: scope.createdAt.toISOString(),
    })
  );
});

router.get("/scopes/:id", async (req, res): Promise<void> => {
  const params = GetScopeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [scope] = await db.select().from(scopesTable).where(eq(scopesTable.id, params.data.id));
  if (!scope) {
    res.status(404).json({ error: "Scope not found" });
    return;
  }

  const [{ targetCount }] = await db
    .select({ targetCount: count() })
    .from(targetsTable)
    .where(eq(targetsTable.scopeId, scope.id));

  res.json(
    GetScopeResponse.parse({
      ...scope,
      validFrom: scope.validFrom ?? null,
      validUntil: scope.validUntil ?? null,
      description: scope.description ?? null,
      targetCount: Number(targetCount),
      createdAt: scope.createdAt.toISOString(),
    })
  );
});

router.patch("/scopes/:id", async (req, res): Promise<void> => {
  const params = UpdateScopeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateScopeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [scope] = await db
    .update(scopesTable)
    .set(parsed.data)
    .where(eq(scopesTable.id, params.data.id))
    .returning();

  if (!scope) {
    res.status(404).json({ error: "Scope not found" });
    return;
  }

  const [{ targetCount }] = await db
    .select({ targetCount: count() })
    .from(targetsTable)
    .where(eq(targetsTable.scopeId, scope.id));

  res.json(
    UpdateScopeResponse.parse({
      ...scope,
      validFrom: scope.validFrom ?? null,
      validUntil: scope.validUntil ?? null,
      description: scope.description ?? null,
      targetCount: Number(targetCount),
      createdAt: scope.createdAt.toISOString(),
    })
  );
});

router.delete("/scopes/:id", async (req, res): Promise<void> => {
  const params = DeleteScopeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [scope] = await db.delete(scopesTable).where(eq(scopesTable.id, params.data.id)).returning();
  if (!scope) {
    res.status(404).json({ error: "Scope not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
