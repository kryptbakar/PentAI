---
name: Sentinel scopeId filter pattern
description: How to filter scans/findings by scopeId when those tables don't store scopeId directly
---

The `scans` and `findings` tables don't have a `scopeId` column. Scope membership is resolved through the `targets` table.

Pattern used in both `/scans` and `/findings` routes:
```ts
const targetIds = await db
  .select({ id: targetsTable.id })
  .from(targetsTable)
  .where(eq(targetsTable.scopeId, qp.data.scopeId));
const ids = targetIds.map((t) => t.id);
if (ids.length === 0) { res.json([]); return; }
const { inArray } = await import("drizzle-orm");
conditions.push(inArray(scansTable.targetId, ids));
```

**Why:** Denormalized for query simplicity; adding scopeId to every row would require updating on scope changes and is redundant given the target FK.

**How to apply:** Any future filter by scopeId on scans/findings/audit should use this subquery pattern. If performance becomes an issue with large datasets, add a DB index on `targets.scope_id`.
