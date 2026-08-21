# PGS HUB — Production Readiness

## Current gate

```text
STATUS: BLOCKED
```

The active release assessment is [FINAL_ACCEPTANCE_REPORT.md](FINAL_ACCEPTANCE_REPORT.md). This repository must not contact or modify a production Supabase project from local release scripts.

Before production can be considered, all of the following must be true:

1. The exact tested SHA is on `main` after the approved PR #7 merge.
2. The disposable local migration, RLS, role-UAT, storage, socket, and UI matrices pass on that SHA.
3. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, and `pnpm test` pass.
4. The release report has current command output and screenshots.
5. A separate explicit production authorization is granted.

Use [FULL_SYSTEM_TEST_ENVIRONMENT.md](FULL_SYSTEM_TEST_ENVIRONMENT.md) for the safe local runbook. Do not treat historical CI totals or UAT claims as current evidence.
