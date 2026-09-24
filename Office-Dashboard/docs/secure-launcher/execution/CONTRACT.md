# Secure multi-platform launcher contract

Source of requirements: `Hair_Rap_by_YOYO_Secure_Multi_Platform_Launcher_Handoff (1).zip`, dated 2026-09-22. This records the implemented protocol and remaining acceptance work.

## Existing entities

## N01 repair contract (2026-09-23, supersedes conflicting historical claims)

### Scope and invariants

Extend the nested application. No cookies, social passwords, QR/OTP/2FA data or arbitrary commands enter the launcher API. The existing credential vault remains unrelated. `PhoneAccountLink` is checked at every privileged issue/consume/confirmation; platform derives from the account's existing Platform relation. Device/account is the unique mapping, even when an account links to multiple phones. Profile keys are random 32-character lowercase hex. A device never receives another device's mappings.

### Device enrollment and trust

1. ADMIN creates a pending registered device and a random one-use pairing token (10-minute expiry). Only its SHA-256 hash is persisted. The raw token is shown once; no device API key is shown in the dashboard.
2. Windows launcher submits token to `POST /api/v1/launcher/pair` over HTTPS (HTTP allowed only for explicit loopback development). Transactionally match unexpired hash and consume it while assigning a fresh random bearer device key. The launcher receives the key once. It saves it with Windows user-scoped DPAPI under LOCALAPPDATA/HairRap, never adjacent plaintext JSON. Lost response requires a new admin pairing token; token replay cannot recover the credential.
3. ADMIN explicitly approves after verifying device code/name/hostname. PENDING launch is prohibited. Capability announcement and device-authenticated heartbeat are required. UI heartbeat is not cryptographic identity evidence.
4. Revoke clears credential and invalidates outstanding grants/tickets in one transaction. Disable similarly invalidates grants/tickets, requires admin action and cannot be undone through self-registration. Re-pairing always returns to PENDING and invalidates prior authorizations. Existing enrollment/key rotation route must not bypass this lifecycle.

### Initiating local device proof

Dashboard calls only the configured loopback launcher (127.0.0.1). Launcher origin/JSON/Host checks protect browser requests. It calls a device-authenticated `/launcher/local-proof` API for a server-signed short-lived receipt scoped to grant ID or session ID/version and device. The device key hash is not used as an HMAC signing secret. Receipt signature uses a purpose-separated server secret; the backend verifies signature, expiry, device approval and exact reference. A deviceId from health/query remains a hint. This proves possession of the credential via the local launcher; compromised OS or malicious trusted-origin script is outside the local-browser isolation guarantee.

### Reauthentication, operation authorization and concurrency

`POST /launch/reauth` accepts existing dashboard password and exact phone/account/device/operation. Verify active ADMIN/EDITOR, account lock, password, phone link and approved online device. Apply per-user throttling and atomic failed-attempt increments. Return a hashed-secret grant with four-minute expiry, single use, actor/version/auth-session binding. Password remains component memory only and is erased on completion.

Grant creation precedes local proof, because the proof references the grant ID; a grant alone cannot launch. Setup/open/reconnect issue requires proof of that grant, exact scope and expected mapping version. Validate all relationships again within transaction. Atomically consume grant, establish session launch state, create 45-second signed ticket and audit. Use database transaction/row ordering to serialize session setup, revoke and consume. A conditional ticket update consumes once; retries after uncertain consume must obtain a fresh grant/ticket, never reuse an authorization.

Ticket claims and persisted grant bind actor, device, phone, account, mapping ID/version and operation; store nonce hash only. Launcher submits ticket with its bearer key to `/launcher/platform-consume`; server verifies MAC/TTL, actor active role/version/session, device approval/fresh heartbeat, live association/platform, mapping state/version, operation and unused ticket. Response exposes only operation ID, operation, opaque profile key, approved official home. No launcher-side secret capable of signing tickets is distributed.

Acknowledgment is device-authenticated, tied to consumed operation, and idempotent for identical result. It records DELIVERED or FAILED; browser start never changes human identity assurance. Conflicting repeated acknowledgment is rejected. Expired undelivered operations are displayed as expired rather than permanently pending.

### Session state machine

- New mapping: SETUP_REQUIRED. SETUP -> SETUP_IN_PROGRESS after authorization. Delivered SETUP plus explicit local operator confirmation -> USER_CONFIRMED (assurance USER_CONFIRMED_ON_DEVICE).
- OPEN requires USER_CONFIRMED. A process start does not refresh the confirmation timestamp.
- Operator marks RELOGIN_REQUIRED with optimistic version; clears assurance and invalidates outstanding tickets. RECONNECT requires a new password grant and moves to SETUP_IN_PROGRESS; human confirmation is required again.
- DISABLED requires explicit versioned action, invalidates outstanding tickets and clears assurance. It cannot silently reactivate. ERROR/expired setup has a visible retry path requiring new authorization. Duplicate setup uses the same immutable profile key and cannot create another active device/account mapping.
- Confirmation checks exact phone/account/device mapping, version and delivered setup/reconnect evidence before recording identifier/actor/time. Arbitrary typed text is a human assertion, never platform verification; UI makes the selected identity and attestation explicit.

### API integration (existing paths retained)

| Route | Authorization / result |
|---|---|
| `GET /phone-numbers/:id/accounts` | Existing authenticated lookup; PhoneAccountLink remains authoritative |
| `GET /devices`, `POST /devices` | Existing read rules; ADMIN create now returns pending device/pairing token |
| `POST /devices/:id/pairing-code` | ADMIN, versioned; issue fresh one-use token, reset trust and revoke old grants/tickets |
| `POST /devices/:id/approve-launcher`, `/revoke-launcher` | Existing ADMIN routes; explicit version; transaction + audit |
| `DELETE /devices/:id` | ADMIN disable and invalidate outstanding authorizations |
| `POST /launcher/pair` | One-use pairing token only; rate limited; returns protected-storage credential once |
| `POST /launcher/local-proof` | Device bearer; exact existing grant or session scope; server-signed receipt |
| `POST /launch/reauth` | ADMIN/EDITOR password challenge, exact operation scope |
| `GET /launch/phone-numbers/:phoneId/accounts/:accountId/session` | Existing role and link validation; return device state and mapping state, no profile path |
| `POST /launch/phone-numbers/:phoneId/accounts/:accountId/setup`, `/open`, `/reconnect` | ADMIN/EDITOR, grant + local proof + expected version; return one-use ticket/operation ID |
| `POST /launch/sessions/:sessionId/confirm` | ADMIN/EDITOR, exact scope, local proof, version and delivered setup/reconnect |
| `POST /launch/sessions/:sessionId/relogin-required`, `/disable` | ADMIN/EDITOR, association/mapping/version; invalidate outstanding operation tickets and audit |
| `GET /launch/operations/:operationId` | Actor-only read; requested/delivered/failed/expired/revoked |
| `POST /launcher/platform-consume`, `/platform-ack` | Device bearer, exact ticket/operation binding; no frontend identity trusted |

### URL and process contract

Platform profile URLs are metadata only. Validate raw input before URL normalization: reject controls, whitespace within URL, backslashes, non-ASCII authority, credentials, ports, encoded ambiguous paths, redirects/query destinations, noncanonical hosts, IP/loopback and unapproved paths. Privileged launch always uses a fixed official HTTPS home. Python accepts only those exact homes, fixed installed Chrome/Edge paths and opaque profile keys; reject symlinks/reparse ancestry and traversal, use argv with shell=False. No automatic website navigation/login scraping or credential injection.

### WhatsApp compatibility

N12 must adapt the existing logical `WhatsappSession` and `WhatsappDeviceSession` child records to the same password/ticket/trust requirements. PhoneAccountLink must resolve the WhatsApp platform account; never infer login identity from a phone/session code. Existing primary profile remains on its PC and is not copied/deleted. Other PCs receive independent opaque profiles. Existing phone/WhatsApp display and audit history remain available. Legacy polling and direct launch must not remain an authorization bypass. No prior LINKED state becomes a new human confirmation automatically. Contract additions for the legacy-primary mapping require explicit review before N12 code.

### Audit and failure contract

State mutation and security audit commit together for pairing, approval/revoke, setup, confirmation, ticket issue/consume/delivery/failure, relogin/disable and URL changes. Metadata: actor, phone, account, device, operation, safe reason and timestamp; never raw password/key/grant/ticket or browser material. Unauthorized/forged scopes return 403/404 without revealing unrelated records; stale versions 409; expired authorizations fail closed; offline/unapproved PC prompts corrective UI. Backend/API failure cannot fabricate delivery.

### Validation gates and release boundary

N02 schema/migrations before N03 associations, N04 enrollment, N05 mapping, N06 reauth, N07 tickets, N08 Python, N09 public routes, N10/N11 UI, N12 WhatsApp, N13 devices, N14 integration, N15 scale/recovery, N16 regression/security, N17 independent review, N18 release. Existing code in later nodes is audited but not marked accepted prematurely. Real PostgreSQL tests must use a fresh isolated sl_test_ schema with refusal guards; never public reset. Test 100 synthetic mappings and real concurrent ticket/setup/revoke cases. Human two-PC Windows/browser/identity tests remain HUMAN_VALIDATION_PENDING until witnessed. READY_FOR_HUMAN_UAT requires automated implementation gates to pass; incomplete software is not UAT-ready.

## Historical entity notes

The application already has `phone_numbers`, `platform_accounts`, `phone_account_links`, `registered_devices`, `whatsapp_sessions`, and audit tables in `prisma/schema.prisma`. `platform_accounts.profile_url` exists. Phase 2 has one WhatsApp session per number and one assigned device. Preserve those tables and behavior. The target project is this nested `Office-Dashboard/Office-Dashboard` tree.

## Trust boundary

The browser sends a phone and account selection. The API verifies the persisted association, user role, active device approval, heartbeat, local launcher proof, password reauthentication, and matching device session. A browser-supplied device ID is only a lookup hint. The launcher accepts only signed, short-lived, one-use commands addressed to its own device; it chooses a fixed official HTTPS destination and an opaque profile key beneath its fixed local profile root. Browser launch acknowledgment means a process opened, never that the third-party account is logged in.

## Data contract

Add `device_platform_sessions` with unique `(device_id, platform_account_id)` and `(device_id, profile_key)`, state, operator confirmation, version, and timestamps. Add scoped one-use launch grants and tickets with hashed secrets. Extend `registered_devices` with explicit approval and capability rather than inferring approval from `enabled` or heartbeat. Add per-device WhatsApp child sessions without altering the primary WhatsApp row or its directory. Retain audit history on archive/revoke.

## Permission and action contract

Admin approves/revokes devices. Admin and Editor may set up and open associated accounts after password reauthentication. Viewer may read permitted records but may not launch. Setup and open run only on the initiating approved Windows PC after cryptographic launcher proof. Every state mutation uses a version check and records a safe audit event. Revoke invalidates grants and tickets; local browser data needs a separate authorized cleanup.

## URL policy

Use fixed official homes for privileged setup and open. Existing public profile URLs are metadata and never prove identity. Validate edits as HTTPS with canonical platform-specific hosts and paths; reject credentials, ports, IP/loopback, deceptive subdomains, fragments or redirect parameters that can leave approved hosts. Unsupported platforms cannot launch until an Admin-reviewed fixed host policy exists.

## Test boundary and remaining acceptance

The user expressly authorized the hosted test connection. Migration and API tests used isolated `sl_test_` schemas; `public` was not modified. The protocol passes synthetic tests, but no physical two-PC browser acceptance has occurred. The WhatsApp child-session runtime remains incomplete. See `NODE_LEDGER.md` for current status.
