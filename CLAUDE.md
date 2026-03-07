# CLAUDE.md

This file is the canonical agent contract for this repository.

## Harness Contract

### Mission

Deliver changes that are deterministic, verifiable, and architecture-consistent.

### Required Commands Before Merge

```bash
pnpm harness:check
pnpm harness:eval
cd backend && go test ./...
```

### Command Reference

```bash
# Development
make dev
make db-up
make db-down

# Build
make build

# Quality
pnpm ci:required
pnpm ci:full
make harness-check
make harness-eval
```

### Architecture Map

- Backend entrypoint: `backend/cmd/api/main.go`
- Backend core layers: `internal/config -> internal/storage -> internal/tokenizer -> internal/telemetry -> internal/logging -> internal/documents -> internal/http`
- Frontend app: `apps/web`
- Extension app: `apps/extension`
- Shared packages: `packages/types`, `packages/tokenizer`, `packages/engine`, `packages/ui`, `packages/api-client`
- Harness system-of-record: `harness/`

### Agent Rules

- Prefer deterministic tests with fixed inputs, fixed clocks, and no network dependencies.
- When incidents/regressions occur, add or update a harness fixture/check in the same PR.
- Keep `harness/registry.json` accurate for owners, commands, and gating levels.
- Do not introduce new required CI gates that are known unstable.

## Definition of Done

A change is done only when all are true:

1. `pnpm harness:check` passes.
2. `pnpm harness:eval` passes.
3. Backend tests pass: `cd backend && go test ./...`.
4. If behavior changed, fixture expectations are updated intentionally.
5. PR description includes a short note for any harness additions/updates.

## Failure Playbooks

- Test discovery failures: `harness/playbooks/test-discovery-failures.md`
- Flaky timing tests: `harness/playbooks/flaky-timing-tests.md`
- Lint regressions: `harness/playbooks/lint-regressions.md`

## Frontend Design Guardrails

Avoid generic UI output. Keep typography, color, and motion choices intentional and distinct for this product context.
