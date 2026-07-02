# Contributing to PentAI

Thanks for your interest in improving PentAI.

## Development setup

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL (and optionally ANTHROPIC_API_KEY)
docker compose up -d          # Postgres + Redis
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/sentinel run dev
```

## Before opening a pull request

Run the same checks CI runs:

```bash
pnpm run typecheck            # types across every package
pnpm -r --if-present run test # unit tests
pnpm run build                # PORT=5173 BASE_PATH=/ pnpm run build
```

## Conventions

- **Contract-first.** The API is defined in `lib/api-spec/openapi.yaml`. After
  changing it, regenerate hooks and validators:
  `pnpm --filter @workspace/api-spec run codegen`. Never hand-edit generated
  files under `lib/api-client-react/src/generated` or `lib/api-zod/src/generated`.
- **Authorization is a single chokepoint.** Any new scan-trigger path must call
  `authorizeTarget` rather than re-implementing the checks.
- **New tool adapters** implement the `ToolAdapter` interface and register in
  `artifacts/api-server/src/adapters/registry.ts`. Anything active/intrusive must
  set `requiresActiveMode: true`.
- Keep the TypeScript strict; no `any` unless justified.

## Reporting security issues

See [SECURITY.md](./SECURITY.md) — do not open public issues for vulnerabilities.
