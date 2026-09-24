# N02 migration validation: 2026-09-23

Isolated PostgreSQL 18 cluster: `.local/secure-launcher-postgres`, loopback port 55438, disposable synthetic data only. No hosted database was accessed. Local cluster is ignored by Git. `tests/e2e/migration-local.cjs` fixes the connection to that local test port/user and strips inherited PostgreSQL environment overrides.

Order: generate baseline SQL from `QA_EVIDENCE/N02-before.prisma`; apply `SECURE_LAUNCHER_MIGRATION.sql` (already contains hardening/backfill; do not also apply the standalone hardening file), then `SECURE_LAUNCHER_PAIRING_MIGRATION.sql`. Existing SQL scripts are the project's migration convention. Pairing upgrade adds only nullable pairing hash/expiry/paired timestamp, unique hash index and consistency check. It does not infer approval, pair existing devices, alter profile data or reset users.

| Command / check | Exit / result |
|---|---|
| Prisma migrate diff from empty to N02-before snapshot | 0; generated `.local/n02-baseline.sql` |
| `node tests/e2e/migration-local.cjs` | 0; schema `sl_test_migration_f5f917ff47`: populated upgrade, repeated backfill, UNKNOWN assurance, unchanged legacy directory, invalid pairing metadata rejection, rollback preservation and reapply PASS |
| `node tests/e2e/migration-local.cjs --fresh` | 0; schema `sl_test_migration_3b9343ad5b`: fresh upgrade PASS |
| Prisma migrate diff from migrated local schema URL to `prisma/schema.prisma --exit-code` | 0; **No difference detected** |
| `npm.cmd run build` | 0; generated client and TypeScript pass |
| `npm.cmd test -- --reporter=dot` | 0; 118 tests pass |
| backend lint, typecheck, frontend lint | 0; pass |

Initial harness failure from empty PGSERVICE was fixed by omitting PostgreSQL environment variables entirely. Sandbox process/network restrictions required approved escalations for PostgreSQL child processes and Prisma. Pairing CHECK explicitly guards SQL NULL semantics: both fields absent or valid hash plus non-null expiry.

Foreign keys and uniqueness inherited from the existing additive migration were applied successfully; parity checks indexes/relations/enums/nullability against Prisma. SQL-only checks remain in migrations and targeted negative assertions. Full ticket/FK race coverage belongs to N14-N16, not this schema checkpoint. Frontend build and Python baseline remain unchanged from N00; N02 changes do not affect their source. Test cleanup now refuses implicit DATABASE_URL and requires an explicit isolated TEST_DATABASE_URL.
