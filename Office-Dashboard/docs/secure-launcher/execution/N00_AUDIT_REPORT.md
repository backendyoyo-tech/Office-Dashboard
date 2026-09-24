# N00 AUDIT REPORT — 2026-09-23

## Scope and provenance

The workspace contains `HRBY_DASHBOARD_PACKAGE`, `Office-Dashboard`, and the nested `Office-Dashboard/Office-Dashboard` application. The nested application is the implementation target: it contains the secure-launcher services, schema extensions, frontend integration and prior execution checkpoint. Git resolves to the enclosing Office-Dashboard repository (baseline commit `eb7266f`). No AGENTS.md was found in the workspace. Existing changes to `frontend/src/pages/AccountDetailPage.tsx` and untracked `docs/phase1/` must be preserved. Earlier documentation is historical evidence, not current certification.

## Architecture and inventory

| Concern | Actual implementation and relevant files |
|---|---|
| Backend | Express 4, TypeScript, Zod; `src/app.ts`, `src/server.ts`, `src/routes/v1/index.ts`; API mounted at `/api/v1`; helmet, CORS, global rate limiting, request IDs and centralized errors |
| Database | PostgreSQL/Prisma 6; `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db/prisma.ts`; SQL migrations/verification/backfill/rollback in `database/`; no Prisma migrations directory |
| Dashboard auth | `src/modules/auth/auth.service.ts`, auth controller/routes, `src/middleware/auth.ts`; Argon2 password verification, JWT bearer authentication, DB-loaded active user/role, failed-login lockout, stored refresh-token hash |
| RBAC | `src/middleware/rbac.ts`; ADMIN device administration; ADMIN/EDITOR mutation and launcher routes; VIEWER read access. Existing WhatsApp service also checks creator access for non-admin users |
| Phone inventory | `src/modules/phone-numbers/`; authoritative `PhoneNumber`, archive/version support; account list and link/unlink endpoints |
| Accounts | `src/modules/platform-accounts/`, validation and `src/lib/platform-url.ts`; `PlatformAccount.profileUrl` already exists. Existing encrypted credential vault is separate and must never feed the launcher |
| Associations | `PhoneAccountLink`, unique phone/account/relationship tuple; `src/lib/association.ts` checks active nonarchived phone, nonarchived account and active platform |
| Devices | `RegisteredDevice`, `src/modules/devices/`, `src/lib/device-state.ts`, `src/lib/platform-device.ts`; availability separate from PENDING/APPROVED/REVOKED approval; hashed bearer key, heartbeat, capability flag, approval/revoke endpoints |
| Launcher device auth | `src/middleware/launcher-auth.ts`, `src/modules/launcher/`; bearer hash lookup; legacy enrollment uses admin JWT/shared enrollment key/current device key, not a one-use pairing code |
| Secure sessions | `src/modules/secure-launcher/session.service.ts`; opaque 16-byte hex key, unique device/account mapping, no cookies; platform derived through account relation |
| Grants and tickets | `grant.service.ts`, `ticket.service.ts`, `local-proof.ts`; four-minute hashed one-use password grant, 45-second HMAC ticket, hashed nonce, transactional conditional consumption, device/account/phone/operation/version binding |
| Windows runtime | `launcher/main.py`, `api_client.py`, `server.py`, `platforms.py`, `browser.py`, `config.py`, `security.py`, `.bat` installers; Python requests, loopback port 12345, origin-checked JSON platform interface, fixed official destinations and Chrome/Edge argv spawning |
| WhatsApp | `WhatsappSession` has unique phone and one primary device; `WhatsappDeviceSession` child exists but runtime still queries parent. `src/modules/whatsapp/`, launcher poll/confirm/status routes and `frontend/src/components/whatsapp/` remain Phase 2 paths |
| Audit | `AuditLog`, `WhatsappAuditLog`, `src/middleware/audit.ts`, `src/modules/audit/`; helpers swallow audit failures; newer secure-launcher paths write directly |
| UI | React 18/Vite, React Query, axios, Tailwind; `frontend/src/App.tsx`, `contexts/AuthContext.tsx`, `lib/api.ts`; number detail embeds WhatsAppSection and PlatformLauncherControls; DevicesPage already has approval/revoke mutation code despite stale checkpoint claiming it missing |
| Build/deployment | Backend `prisma generate && tsc`, module-alias runtime; frontend `tsc && vite build`; Vite port 3000 proxy to backend 3001; server binds PORT or 10000; `.env.example` describes DB/auth/encryption/origins/ticket secrets. No CI/container deployment manifest discovered in target |
| Tests | 7 Vitest files (118 passing baseline cases), `tests/e2e/baseline-runtime.cjs` isolated-schema smoke, two Python test files (6 cases); existing test setup contains unguarded destructive cleanup and must not be used against hosted/public data |

## Models and relationships

`AppUser` owns creation/update/audit and confirmation metadata. `PhoneNumber` links to `PlatformAccount` only through `PhoneAccountLink`; `PlatformAccount` belongs to `Platform`. `RegisteredDevice` has independent `DevicePlatformSession` rows keyed by `(deviceId, platformAccountId)`. Profile keys are unique per device. `LaunchGrant` binds actor, user version, auth-session hash, device, phone, operation and either platform account or legacy WhatsApp session. `LaunchTicket` references grant, device, mapping/version, nonce hash, expiry, consumption and acknowledgment. SQL hardening adds one-target checks, key format and TTL checks. `WhatsappDeviceSession` maps logical WhatsApp session plus device but has no runtime integration yet. Restrict FKs preserve launch references; confirmation-user deletion sets null. No new browser-cookie/session-token storage exists.

## Existing API surface to extend

- `/phone-numbers/:id/accounts` and `/platform-accounts/:id/link-phone` already manage authoritative associations.
- `/devices` CRUD, `/:id/approve-launcher`, `/:id/revoke-launcher`, sweep and heartbeat already exist.
- `/launch/reauth`, `/launch/phone-numbers/:phoneId/accounts/:accountId/session`, `/setup`, `/open`, `/launch/sessions/:sessionId/confirm`, `/launch/operations/:operationId` exist.
- `/launcher/register`, `/heartbeat`, `/platform-capability`, `/platform-consume`, `/platform-ack`, `/whatsapp-launch`, `/whatsapp-confirm`, `/whatsapp-status` exist.
- `/phone-numbers/:phoneId/whatsapp` CRUD, setup/open/reconnect/confirm-link/status-update exist. These old paths lack the new password/ticket protocol.

## Gaps and risks (source inspection, not exploitation claims)

1. **Credential protection:** `launcher/config.py` writes the device API key to plaintext adjacent JSON. Local proof uses the stored key hash itself as HMAC key, making that hash a proof credential. Pairing must replace shared enrollment with expiring one-use, explicitly approved enrollment and protected local storage.
2. **Bootstrap injection:** `launcher/setup.bat` interpolates interactive input into `python -c` source. Replace that setup path with Python prompts and safe argv, preserving install ergonomics.
3. **WhatsApp:** child schema is unused; parent polling can launch without the new step-up/ticket guarantees. Preserve existing profiles and data, but route privileged execution through the secure protocol. Browser startup must never imply LINKED/verified identity.
4. **Session lifecycle:** no generic relogin/disable/reconnect API; failed/expired setup can strand UI in SETUP_IN_PROGRESS. Confirmation currently lacks delivered-operation prerequisite; last launch result is not tied to a single current operation.
5. **Concurrency:** mapping upsert is useful but setup state changes occur after issuance outside its transaction. Device revoke/disable, mapping changes, account unlink and ticket consumption need explicit locking/ordering and real database races.
6. **Reauthentication:** password-failure counters use read-modify-write; no dedicated per-user reauth limiter. Current local proof comes after grant issuance, unlike an overbroad comment in the grant service. Contract must describe this accurately or adjust handshake.
7. **Audit:** ticket issuance/setup/request events are incomplete; nontransactional audit can miss successful state changes. Do not log passwords, raw grants/tickets or device credentials.
8. **Trust/authorization:** ticket consumption rechecks user version and status but needs explicit role/platform-active checks. Dashboard heartbeat can claim device availability without device authentication. Registration may re-enable an existing device; approval/version semantics require tightening.
9. **URL:** official launch homes are safe fixed targets, but metadata URL parser normalization needs tests for backslashes, Unicode host normalization and redirect endpoint paths. Unsupported platform slugs must fail closed.
10. **Verification:** historical test claims are not release certification. Constant-only Phase 2 contract cases and copied validation tests are not HTTP/DB integration tests. Missing lint configurations block required checkpoints. Test cleanup lacks disposable-schema guard. Real two-PC/browser login remains HUMAN_VALIDATION_PENDING.

## Specification mapping and planned change boundaries

Reuse `PhoneAccountLink`, existing auth/RBAC, registered devices, device/account session table, grant/ticket tables and Python launcher. Derive platform from account rather than add a disagreeing platform relation. Keep USER_CONFIRMED enum but expose assurance USER_CONFIRMED_ON_DEVICE. Extend existing routes; do not add a second account/link/device system.

Exact existing files expected to change, subject to N01 contract:

- `prisma/schema.prisma`; `database/SECURE_LAUNCHER_MIGRATION.sql`, `SECURE_LAUNCHER_HARDENING.sql`, `SECURE_LAUNCHER_VERIFY.sql`, `SECURE_LAUNCHER_ROLLBACK.sql`, `SECURE_LAUNCHER_BACKFILL.sql` (additive follow-up migration preferred).
- `src/modules/secure-launcher/{grant.service,ticket.service,local-proof,session.service,secure-launcher.routes}.ts`.
- `src/modules/devices/{devices.service,devices.controller,devices.routes}.ts`; `src/modules/launcher/{launcher.service,launcher.controller,launcher.routes}.ts`; `src/middleware/launcher-auth.ts`.
- `src/modules/whatsapp/{whatsapp.service,whatsapp.controller,whatsapp.routes}.ts`; `src/lib/{platform-url,platform-device,association}.ts` where focused guards are needed.
- `launcher/{main,api_client,server,config,platforms,security,browser}.py`, `launcher/setup.bat`, `launcher/README.md`.
- `frontend/src/components/launcher/PlatformLauncherControls.tsx`, `frontend/src/pages/{NumberDetailPage,DevicesPage}.tsx`, `frontend/src/components/whatsapp/{WhatsAppSection,SetupWhatsAppDialog,ChangeDeviceDialog}.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/index.ts`.
- `tests/setup.ts`, targeted new security/integration/recovery tests, execution documents, root/frontend lint configuration and package metadata if required for parser tooling.

Do not unnecessarily change: `frontend/src/pages/AccountDetailPage.tsx` (pre-existing user diff), `docs/phase1/`, credential vault/encryption and recovery-method services, unrelated dashboard summary, user/password APIs, generic phone/account CRUD, existing profile directories, production environment/secrets, other two project copies. No DB reset or production migration is authorized by this audit.

## N00 checkpoint

Inspection is documented. Runtime baseline: 118 Vitest tests pass; frontend production build passes; backend typecheck passes. Lint repair and Python sandbox retry remain checkpoint tasks at report creation. No feature source or schema was changed during inspection; no database writes were performed. See the dated QA evidence and ledger for final gate outcomes. N01 may start only after this checkpoint is resolved.
