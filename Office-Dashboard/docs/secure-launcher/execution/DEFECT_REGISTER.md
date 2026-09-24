# Defect register

## Current audit additions: 2026-09-23

| ID | Severity | Finding | State / target node |
|---|---|---|---|
| SL-003-R | Quality gate | Backend/frontend lint configs absent | CLOSED N00: configurations and parser added; both lint commands pass |
| SL-005 | P1 | Launcher API key saved as plaintext JSON | OPEN N04/N08: protected local credential storage |
| SL-006 | P1 | Setup batch interpolates operator text into Python source | OPEN N08: replace with Python input workflow |
| SL-007 | P1 | No one-use expiring pairing code; shared enrollment and re-registration lifecycle | OPEN N02/N04 |
| SL-008 | P1 | WhatsApp child mapping unused; legacy launch lacks new step-up/tickets | OPEN N12 |
| SL-009 | P1 | Setup state outside issuance transaction; missing lifecycle/recovery APIs | OPEN N05/N07/N09 |
| SL-010 | P1 | Incomplete transactional launch audit and consume/revoke race coverage | OPEN N07/N14-N16 |
| SL-011 | P1 | Test DB cleanup not restricted to disposable schema | OPEN before database integration tests |
| SL-012 | P2 | Password failure increments race; role/platform checks incomplete at consume | OPEN N06/N07 |
| SL-013 | Validation | Windows symlink privilege test skipped | HUMAN_VALIDATION_PENDING; N16/N18 evidence must retain skip |
| SL-014 | Triage | npm install reports 10 dependency advisories | OPEN N16: determine affected production paths and safe fixes |

## Historical defects

| ID | Severity | Reproduction | Expected | Actual | Owner/state |
|---|---|---|---|---|---|
| SL-001 | P1 QA blocker | Run `npx vitest run --reporter=dot` in target project | Existing suites collect and run | Initially all five suites failed before collection; exact `dotenv/config` file alias fixed it; 87 tests passed on rerun | Test harness; CLOSED |
| SL-002 | P1 validation blocker | Run `psql -w -h 127.0.0.1 -p 5432 -U postgres -d postgres` | Disposable DB access | Local password unavailable; user explicitly authorized hosted test connection; isolated `sl_test_` schema created and used successfully | Environment; CLOSED with isolated hosted schema |
| SL-003 | P2 quality gate | Run `npm run lint` | ESLint checks source/tests | ESLint 9 exits 1 because no `eslint.config.*` exists; no existing ESLint configuration or TypeScript parser dependency is present | Build tooling; open |
| SL-004 | P1 baseline runtime | In isolated schema, create synthetic admin, phone, account, link, then GET `/dashboard/summary` | 200 with metrics | Initially 500: 18 concurrent queries exhausted Supabase session pool (15 connections). Replaced fanout with Prisma transaction and one completeness projection; rerun returned 200 | Backend; CLOSED after isolated API smoke |

No production defect or launcher implementation success is inferred from these blockers.
