import { eq } from "drizzle-orm";
import { db, targetsTable, scopesTable, auditEntriesTable, type Target, type Scope } from "@workspace/db";

export type AuthorizationResult =
  | { ok: true; target: Target; scope: Scope }
  | { ok: false; reason: string };

/**
 * Single chokepoint for the authorization gate. Every scan trigger path (the
 * POST /scans route today; the AI orchestrator and scheduled scans later)
 * must call this instead of re-implementing the checks. Writes the
 * allowed/denied audit entry as a side effect either way.
 */
export async function authorizeTarget(
  targetId: number,
  phase: string,
  tool: string,
  flags: string | null = null,
  operator = "system"
): Promise<AuthorizationResult> {
  const [target] = await db.select().from(targetsTable).where(eq(targetsTable.id, targetId));

  if (!target) {
    return { ok: false, reason: "Target not found or not authorized" };
  }

  const [scope] = await db.select().from(scopesTable).where(eq(scopesTable.id, target.scopeId));

  const deny = async (reason: string): Promise<AuthorizationResult> => {
    await db.insert(auditEntriesTable).values({
      operator,
      targetId: target.id,
      tool,
      flags: reason,
      authorizedBy: null,
      outcome: "denied",
    });
    return { ok: false, reason };
  };

  // 1. Target must be on the allow-list
  if (!target.allowed) {
    return deny("Target is not on the authorization allow-list");
  }

  // 2. Scope must have an active RoE record
  if (!scope || !scope.roeActive) {
    return deny("Scope rules-of-engagement are not active");
  }

  // 3. Scope validity window
  const now = new Date();
  if (scope.validFrom && new Date(scope.validFrom) > now) {
    return deny("Scope engagement has not started yet");
  }
  if (scope.validUntil && new Date(scope.validUntil) < now) {
    return deny("Scope engagement window has expired");
  }

  // 4. Exploit phase requires active mode enabled on target
  if (phase === "exploit" && !target.activeModeEnabled) {
    return deny("Active/exploit mode is not enabled for this target");
  }

  await db.insert(auditEntriesTable).values({
    operator,
    targetId: target.id,
    tool,
    flags,
    authorizedBy: scope.signedBy,
    outcome: "allowed",
  });

  return { ok: true, target, scope };
}
