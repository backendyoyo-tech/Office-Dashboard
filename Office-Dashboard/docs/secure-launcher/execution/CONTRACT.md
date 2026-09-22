# Secure multi-platform launcher contract

Source of requirements: `Hair_Rap_by_YOYO_Secure_Multi_Platform_Launcher_Handoff (1).zip`, dated 2026-09-22. This records the implemented protocol and remaining acceptance work.

## Existing entities

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
