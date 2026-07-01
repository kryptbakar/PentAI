---
name: Sentinel authorization gate
description: POST /scans hard-enforces 4-layer authorization before any scan job is created
---

Every scan creation must pass all four checks in order; any failure writes a denied audit entry and returns 403.

1. Target exists and `target.allowed === true`
2. Scope exists and `scope.roeActive === true`
3. Current time is within `scope.validFrom` .. `scope.validUntil` (both nullable = no bound)
4. If `phase === "exploit"`, `target.activeModeEnabled === true`

**Why:** The platform's core value proposition and legal safety is the authorization gate. Missing any check enables scans that should be blocked by policy (code review found this on first pass).

**How to apply:** Any future scan trigger path (scheduled scans, AI orchestrator, batch runner) must call the same authorization logic — centralize it into a shared `authorize(targetId, phase)` helper rather than duplicating the checks.
