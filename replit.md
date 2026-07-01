# Sentinel

An authorization-first automated penetration testing dashboard. Orchestrates security tools behind a single pipeline with a hard authorization gate — no scan runs unless the target has a valid scope, active RoE, and is on the allow-list.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/sentinel run dev` — run the frontend dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind (dark cybersecurity theme, JetBrains Mono, electric cyan accent)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM schema (scopes, targets, scans, findings, audit_entries, reports)
- `artifacts/api-server/src/routes/` — Express route handlers (scopes, targets, scans, findings, audit, reports, dashboard)
- `artifacts/sentinel/src/pages/` — React pages (dashboard, scopes, targets, scans, findings, audit, reports)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod validation schemas (do not edit)

## Architecture decisions

- **Authorization gate is a hard chokepoint** — `POST /scans` enforces: target on allow-list, scope roeActive=true, validFrom/validUntil window, active-mode check for exploit phase. Every denied attempt is logged to audit_entries.
- **Append-only audit log** — no DELETE/UPDATE on audit_entries. Route exposes read-only GET only.
- **Contract-first** — OpenAPI spec drives codegen for both Zod validators (server) and React Query hooks (client). Never hand-write types that codegen produces.
- **Demo scan simulation** — `POST /scans` starts the scan in `running` state and resolves to `completed` with mock findings after 3 seconds via setTimeout (for demo purposes; replace with real tool runners in production).
- **scopeId filter on scans/findings** — resolved by joining through the targets table since scans/findings don't directly store scopeId.

## Product

11-page security operations dashboard:
- **Dashboard** — live summary stats, severity bar chart, activity feed, active scans
- **Scopes** — RoE scope management with validity window enforcement
- **Targets** — host directory with allow-list and active-mode indicators
- **Scans** — job management with authorization gate enforcement on creation
- **Findings** — vulnerability findings with CVE refs, evidence, remediation
- **Audit** — immutable append-only log of every tool invocation
- **Reports** — JSON/HTML report generation from completed scans

## User preferences

_Populate as you build._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` before touching routes or frontend.
- `GET /scans/active` and `GET /findings/by-severity` must be registered BEFORE `GET /scans/:id` / `GET /findings/:id` in Express — path-specific routes before param routes.
- Scan simulation uses setTimeout — not durable across server restarts. In production, replace with Celery/BullMQ workers.
- `audit_entries.target_id` is nullable (target may be deleted). The AuditEntry OpenAPI schema reflects this with `type: ["integer", "null"]`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
