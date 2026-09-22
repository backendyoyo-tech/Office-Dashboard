# Security review — pre-implementation draft

This is a source inspection and threat model, not a passed security certification. N01 awaits N00 runtime verification.

## Current trust boundaries

The React client holds a dashboard token and sends record IDs. The Node API enforces user auth, RBAC and account linkage. The Python launcher listens on `127.0.0.1` and currently accepts a bearer API key for WhatsApp launch. Browser profiles contain third-party session secrets on the local Windows account. The external sites control login state; the dashboard cannot infer identity from a URL or process launch.

## Threats and mandatory controls

| Threat | Current observation | Required extension control |
|---|---|---|
| Forged browser device ID | Current Phase 2 device API uses persisted device records | Prove same-PC launcher possession with a signed challenge before any privileged launch; treat client device ID as a hint |
| Stolen/stale command | Phase 2 launcher local HTTP API uses the device API key | Use short-lived device-bound one-use ticket, atomic consume, and audit; do not expose API key to browser JavaScript |
| Arbitrary destination | Phase 2 launcher allows only fixed WhatsApp URL | Enumerate fixed official HTTPS platform homes; never pass a saved public profile URL directly as a privileged command |
| Path escape | `launcher/security.py` checks string prefix and `Path.resolve()` then string prefix; this is insufficient for sibling prefixes and reparse-point/symlink containment | Generate opaque key, join beneath a fixed root, resolve and require actual path ancestry; reject links and traversal |
| Wrong signed-in identity | Browser can show public account pages under another login | Isolate per `(device, account)`, ask for explicit operator confirmation, label it user-confirmed, and offer re-login |
| Revoked device | Existing `enabled` and status fields are separate from approval | Add explicit approval/revocation, expire grants/tickets, deny launch when heartbeat stale; explain external browser logout is separate |
| Password brute force | Existing auth service has lockout counters | Reuse Argon2 verification and rate limits for scoped step-up; never share a universal launch PIN or send passwords to launcher |
| Cross-number IDOR | `phone_account_links` is the association source | Check link on every setup, confirm and open request, including ticket consumption after an unlink |

## Current evidence limits

The 87 existing tests passed after the Vitest resolution repair. They do not validate the proposed extension, local DB state, real external identity, or two-PC behavior. The existing `tests/security/launcher-security.test.ts` uses an in-test TypeScript copy of validation logic rather than exercising the Python launcher, so it cannot certify Python path or command handling.
