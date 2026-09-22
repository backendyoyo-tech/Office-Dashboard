# Checkpoint — 2026-09-22

Target: nested `Office-Dashboard/Office-Dashboard` project. Source: supplied secure multi-platform launcher ZIP. The user authorized the hosted PostgreSQL connection for testing. All database writes for this task used two isolated `sl_test_` schemas named in `QA_EVIDENCE/test-schema-name.txt` and `QA_EVIDENCE/fresh-schema-name.txt`; the public schema was not modified.

Implemented: additive schema/SQL migration and rollback, strict platform URL policy, device approval and revoke API, per-device account mapping, step-up grants, signed one-use tickets, local launcher proof, platform consume/ack protocol, Python browser launcher, and frontend setup/open controls. Existing dashboard pool exhaustion was repaired. Synthetic API smoke, 118 Vitest tests, backend/frontend builds, six Python tests, migration parity, and rollback drill passed. One Python symlink test was skipped due to Windows privilege.

Outstanding: complete the WhatsApp per-device runtime/UI, admin approval UI, real two-PC Windows/browser UAT, concurrency hardening for simultaneous setup requests, lint configuration, and release review. Synthetic acknowledgment cannot prove browser or platform login success. Preserve pre-existing `frontend/src/pages/AccountDetailPage.tsx` modification and `docs/phase1/` contents. Do not write to public schema while continuing test work.
