# Secure launcher implementation ledger — 2026-09-22

| Area | State | Evidence / remaining work |
|---|---|---|
| Baseline and contract | VERIFIED | Isolated schema, baseline API smoke, threat and data contract documented. |
| Additive schema and rollback | VERIFIED IN TEST | Migration, hardening, backfill, negative and rollback SQL under `database/`; populated and fresh isolated schemas exercised; Prisma diff reports no difference. Public schema unchanged. |
| Account linkage and URL policy | VERIFIED IN TEST | Association guard and strict official HTTPS host policy; 118 Vitest tests and synthetic API smoke. |
| Device approval and scoped launch authorization | VERIFIED IN TEST | Approval/revoke API, password step-up, local HMAC proof, hashed one-use grant, signed one-use device-bound ticket, launcher consume/ack; synthetic API smoke. |
| Per-device platform profiles and UI | IMPLEMENTED, PARTIAL QA | Opaque per-device profile mapping, Python browser launcher, setup/open controls on number detail; frontend/backend builds and Python module tests pass. No physical browser run on two Windows PCs yet. |
| WhatsApp multi-PC | PARTIAL | Per-device child schema and idempotent backfill exist. Existing WhatsApp runtime and UI have not been fully switched to independent child sessions. |
| Release and human UAT | PENDING | Real browser sign-in, two approved PCs, reboot/offline/revoke scenarios, visual QA, lint repair and release sign-off remain. |

Synthetic acknowledgment verifies protocol behavior only. It does not establish that a browser opened or that any third-party platform authenticated a user.
