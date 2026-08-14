# PGS Hub Testing

Run all commands from the repository root.

## Full quality gate

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

## Test layers

- API unit tests: Nest services, guards, controllers, migrations, security helpers.
- API e2e tests: authenticated route contracts and cross-module workflows.
- Web tests: React component/API client behavior through Vitest.
- Migration tests: SQL text contract tests for RLS, grants, indexes, function security, and invariants.

## Useful targeted commands

```bash
pnpm --filter api test:unit
pnpm --filter api test:e2e
pnpm --filter web test
pnpm --filter api test:unit -- --runTestsByPath src/automation/automation.service.spec.ts
pnpm --filter api test:unit -- --runTestsByPath src/chat/chat.service.spec.ts
pnpm --filter api test:unit -- --runTestsByPath src/notifications/notifications.service.spec.ts
```

## Test environment

API tests run with `APP_ENV=test` and use `apps/api/.env.test`. That file must contain fake or local-only credentials only. Production secrets must never be required to run tests.

## Release expectation

A release branch is not ready until lint, format, typecheck, test, build, migration contract tests, and static security checks pass locally or in CI.
