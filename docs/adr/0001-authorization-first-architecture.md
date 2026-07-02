# ADR 0001 — Authorization-first, contract-first architecture

Status: Accepted

## Context

PentAI drives real offensive security tooling from a one-click UX. Two forces
are in tension: making it effortless to launch a scan, and making it impossible
to scan something you shouldn't. We also want the front end and back end to
never disagree about the shape of the API.

## Decisions

1. **Single authorization chokepoint.** Every scan-trigger path — the
   `POST /scans` route and the continuous-monitoring scheduler — goes through
   `authorizeTarget()` and the shared `launchScan()` in
   `services/scan-runner.ts`. The gate checks the allow-list, active RoE, the
   validity window, exploit-mode opt-in, and (via `net-guard`) that the host is
   not loopback/RFC1918/link-local/metadata. Denials and approvals are written
   to an append-only audit log. No call site re-implements these checks.

2. **Contract-first API.** `lib/api-spec/openapi.yaml` is the single source of
   truth. Orval generates both the server-side Zod validators and the
   client-side React Query hooks, so a field can't drift between tiers. Adding
   an endpoint = edit the spec, run codegen, implement the route. Named request
   bodies use a distinct component name from the generated `{op}Body` const to
   avoid a type/const collision (see `FindingUpdate`, `ScopeUpdate`).

3. **AI is an optional enrichment layer, never a hard dependency.** The Claude
   analysis (`services/ai.ts`) runs on report generation, gated on
   `ANTHROPIC_API_KEY`, and degrades gracefully to a deterministic summary. It
   never blocks or fails scan/report flows.

4. **In-process eventing and scheduling, with a documented upgrade path.** Live
   scan progress (`services/scan-events.ts`, SSE) and continuous monitoring
   (`services/scheduler.ts`) are in-process today for a single instance. The
   emit/subscribe and launch surfaces are isolated so they can move to Redis
   pub/sub and a durable queue (BullMQ) without touching call sites.

## Consequences

- Adding a safeguard is a one-place change and is unit-tested (`net-guard`,
  `authorizeTarget`, `domain-verify`).
- Multi-instance deployment requires swapping the in-process event bus and
  scheduler for Redis-backed equivalents — a known, bounded change.
- Every schema change is a codegen step; hand-editing generated files is
  disallowed.
