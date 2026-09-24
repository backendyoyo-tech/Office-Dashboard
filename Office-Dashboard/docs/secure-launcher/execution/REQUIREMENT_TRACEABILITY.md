# Requirement traceability

## Current contract mapping (2026-09-23)

| ID | Requirement | Existing code / planned extension | Acceptance node |
|---|---|---|---|
| R01 | Authoritative phone/account association | `src/lib/association.ts`, PhoneAccountLink; transactional issue/consume checks | N03/N14 |
| R02 | Approved authenticated initiating device | registered devices, pairing columns, server receipt/local proof, admin approval | N04/N08/N13 |
| R03 | Isolated local profiles | DevicePlatformSession, launcher/platforms.py fixed root and argv | N05/N08 |
| R04 | Password reauth | grant.service.ts; per-user throttling and atomic failures | N06 |
| R05 | One-use scoped ticket and replay defense | ticket.service.ts; transactional issue/consume/revoke and real DB races | N07/N14/N15 |
| R06 | Safe URLs/process execution | platform-url.ts, platforms.py, replace setup.bat input interpolation | N03/N08 |
| R07 | Human identity assurance | session state and confirm API; delivered operation prerequisite | N05/N09/N10 |
| R08 | Real UI state and recovery | PlatformLauncherControls, NumberDetailPage, DevicesPage, api.ts | N10/N11/N13 |
| R09 | WhatsApp multi-PC preservation | WhatsappDeviceSession adapter and existing profile compatibility; no cookie transfer | N12 |
| R10 | RBAC/IDOR and audit | Existing middleware plus all issue/consume/mutation scopes; transactional audit | N09/N14/N16 |
| R11 | Regression and scale | Baseline tests plus guarded real PostgreSQL and 100 synthetic mappings | N14/N15/N16 |
| R12 | Independent QA and release evidence | No automatic third-party login claims; Windows two-PC human runbook | N17/N18 |

N00 current baseline is verified with explicit limitations; N01 contract documented. Remaining rows are planned acceptance, not completion claims. Historical table below is retained for provenance.

| Requirement | Source | Code | Test/evidence | State |
|---|---|---|---|---|
| Linked account only, per number | Handoff §§1, 3, 8 | Existing `phone_account_links`; extension pending | N03 pending | NOT_STARTED |
| Approved initiating PC and cryptographic proof | §§3, 5, 6 | Pending | N04/N11 pending | NOT_STARTED |
| Per-device isolated account profile | §§3, 6, 7 | Pending | N05/N08 pending | NOT_STARTED |
| Password step-up and one-use ticket | §§5, 7, 8 | Pending | N06/N07 pending | NOT_STARTED |
| Same WhatsApp number on independent PCs | §§3, 7 | Pending | N12 pending | NOT_STARTED |
| Phase 1/2 regression | §§2, 11, 12 | Existing | `QA_EVIDENCE/N00-baseline.md` | BLOCKED |
