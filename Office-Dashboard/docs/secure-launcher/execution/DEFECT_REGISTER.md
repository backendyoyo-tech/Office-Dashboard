# Defect register

| ID | Severity | Reproduction | Expected | Actual | Owner/state |
|---|---|---|---|---|---|
| SL-001 | P1 QA blocker | Run `npx vitest run --reporter=dot` in target project | Existing suites collect and run | Initially all five suites failed before collection; exact `dotenv/config` file alias fixed it; 87 tests passed on rerun | Test harness; CLOSED |
| SL-002 | P1 validation blocker | Run `psql -w -h 127.0.0.1 -p 5432 -U postgres -d postgres` | Disposable DB access | Local password unavailable; user explicitly authorized hosted test connection; isolated `sl_test_` schema created and used successfully | Environment; CLOSED with isolated hosted schema |
| SL-003 | P2 quality gate | Run `npm run lint` | ESLint checks source/tests | ESLint 9 exits 1 because no `eslint.config.*` exists; no existing ESLint configuration or TypeScript parser dependency is present | Build tooling; open |
| SL-004 | P1 baseline runtime | In isolated schema, create synthetic admin, phone, account, link, then GET `/dashboard/summary` | 200 with metrics | Initially 500: 18 concurrent queries exhausted Supabase session pool (15 connections). Replaced fanout with Prisma transaction and one completeness projection; rerun returned 200 | Backend; CLOSED after isolated API smoke |

No production defect or launcher implementation success is inferred from these blockers.
