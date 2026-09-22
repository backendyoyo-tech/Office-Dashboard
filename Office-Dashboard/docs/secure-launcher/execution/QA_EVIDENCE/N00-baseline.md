# N00 baseline evidence — 2026-09-22

## Workspace and provenance

- Target project: nested `Office-Dashboard/Office-Dashboard`, containing `.git`, `.env`, `node_modules`, backend, frontend, launcher, Prisma, and `PHASE_1_RUNTIME_DEFECT_REGISTER.md`.
- Existing Git status before work: modified `frontend/src/pages/AccountDetailPage.tsx`; untracked `docs/phase1/`. Preserved.
- Prior reports conflict: `docs/phase2/PHASE_2_FINAL_COMPLETION_REPORT.md` calls Phase 2 production ready, while `docs/phase1/execution/AUTONOMOUS_RUN_LOG.md` still lists N13–N18 pending. Neither report substitutes for current runtime checks.
- `.env` database host: `aws-0-ap-southeast-1.pooler.supabase.com:5432` (host only recorded; credentials redacted). No connection attempted.
- PostgreSQL 18 service exists at `C:\Program Files\PostgreSQL\18` and accepts connections on localhost port 5432. No local credential was available; noninteractive `psql` returned `fe_sendauth: no password supplied`. No disposable DB created.
- The user then explicitly authorized the hosted test connection. A unique `sl_test_20260922104744_8f1da3` schema was created; no public business tables were written. Clean Prisma push initially failed because `citext` resides in `public`. A `citext` domain was created **inside the test schema**, then Prisma push succeeded. This is a test fixture workaround, not migration parity evidence.

## Actual commands and outcomes

| Command | Exit | Result |
|---|---:|---|
| `npm run typecheck` | 0 | Backend TypeScript passed |
| `npm --prefix frontend run build` | 0 | Frontend TypeScript and Vite production build passed |
| `npm test -- --reporter=dot` | 1 | All five suites failed before collection: virtual `dotenv/config` requires missing `./lib/main` |
| `npx vitest run --reporter=dot` | 1 | Same five suite collection failures, independent of Prisma pretest |
| `npx vitest run --reporter=dot` after exact alias repair | 0 | Five suites, 87 tests passed |
| `npm run lint` | 1 | ESLint 9 cannot find `eslint.config.*`; no prior configuration found |
| `npx prisma db push --skip-generate` with isolated schema URL | 0 | Existing Prisma schema created in isolated schema after test-only citext domain |
| `node -r module-alias/register tests/e2e/baseline-runtime.cjs` with isolated schema URL | 1 then 0 | Initial dashboard 500 from pool exhaustion; after repair, synthetic login, phone/account/link create, details, inventory and dashboard all passed |
| `npm run typecheck` and `npm run build` after dashboard repair | 0 each | Backend passes |

An attempted import-style change did not fix the test runner and was reverted. An exact `dotenv/config` alias in `vitest.config.ts` fixed it. A later `npm test` also hit `EPERM` while Prisma tried to replace `query_engine-windows.dll.node`; direct Vitest bypassed that pretest and passed. Synthetic runtime API and CRUD checks now pass in the isolated schema. External login and multi-PC checks have **not** passed. Existing security *unit* tests passed, without launcher runtime evidence.
