# Phase 1 Runtime Defect Register

## Environment
- Backend: Node.js/Express/TS on port 3001 (compiled via `tsc` + `node dist/_bootstrap.js` due to tsx esbuild EPERM sandbox limitation)
- Frontend: React 18/Vite on port 3000 (dev server blocked by esbuild EPERM; API tested via direct HTTP calls)
- Database: PostgreSQL 16 (port 5433, local)
- Verification method: Direct API testing with `Invoke-RestMethod` + backend logs

## Defects Found

### D-001: Dashboard Summary — Response Shape Mismatch (CRITICAL)
- **Endpoint**: `GET /api/v1/dashboard/summary`
- **Frontend expects** (`DashboardSummary` type):
  ```json
  { "totalNumbers": N, "activeNumbers": N, "connectedAccounts": N,
    "incompleteNumbers": N, "loginIssueAccounts": N,
    "whatsappLinked": N, "whatsappSetupRequired": N, "whatsappError": N, "whatsappDisabled": N,
    "recentActivity": [...] }
  ```
- **Backend returns**:
  ```json
  { "phones": {"total":N,"active":N,"archived":N,"inactive":N},
    "accounts": {"total":N,"withCredentials":N,"byPlatform":[...]},
    "users": {"active":N}, "devices": {"total":N,"online":N},
    "whatsapp": {"totalSessions":N,"linked":N,"setupRequired":N,"error":N},
    "recentActivity": [...] }
  ```
- **Impact**: DashboardPage renders `undefined` for all card values
- **Root cause**: Backend response shape evolved independently of frontend contract
- **Fix**: Flatten backend response to match `DashboardSummary` type

### D-002: Platforms Route 404 (CRITICAL)
- **Frontend calls**: `GET /platforms`
- **Backend has**: `GET /platform-accounts/platforms` (mounted at `/platform-accounts`)
- **Impact**: AddEditNumberPage devices dropdown works but platforms list 404; any page needing platforms fails
- **Fix**: Add `/platforms` mount in v1/index.ts

### D-003: Audit Logs Route 404 (CRITICAL)
- **Frontend calls**: `GET /audit-logs`
- **Backend has**: `GET /audit` (mounted at `/audit`)
- **Impact**: AuditLogsPage shows "Failed to load data" (404)
- **Fix**: Change mount from `/audit` to `/audit-logs`

### D-004: Phone-Account Links Routes Missing (CRITICAL)
- **Frontend calls**:
  - `GET /phone-numbers/:phoneId/accounts` → expects `PhoneAccountLink[]`
  - `POST /phone-numbers/:phoneId/accounts` → with `{ platformAccountId, relationshipType?, isPrimary? }`
  - `DELETE /phone-numbers/:phoneId/accounts/:linkId`
- **Backend**: No such routes; linking only available via `/platform-accounts/:id/link-phone`
- **Impact**: NumberDetailPage cannot display connected accounts or link/unlink
- **Fix**: Add phone-account links routes under phone-numbers

### D-005: Phone Number Archive — HTTP Method Mismatch (HIGH)
- **Frontend calls**: `DELETE /phone-numbers/:id`
- **Backend has**: `POST /phone-numbers/:id/archive`
- **Impact**: Archive action fails with 404
- **Fix**: Add DELETE route for archive

### D-006: Platform Account Archive — HTTP Method Mismatch (HIGH)
- **Frontend calls**: `DELETE /platform-accounts/:id`
- **Backend has**: `POST /platform-accounts/:id/archive`
- **Impact**: Archive action on AccountDetailPage fails with 404
- **Fix**: Add DELETE route for archive

### D-007: Credential Reveal Route Mismatch (HIGH)
- **Frontend calls**: `POST /platform-accounts/:id/reveal-credential` → expects `{ password, expiresAt }`
- **Backend has**: `GET /credentials/:id/reveal` → returns `{ password, keyVersion, secretUpdatedAt }`
- **Impact**: Cannot reveal credentials on AccountDetailPage
- **Fix**: Add reveal-credential route under platform-accounts

### D-008: Credential Update Route Mismatch (HIGH)
- **Frontend calls**: `PUT /platform-accounts/:id/credential` → with `{ password }`
- **Backend has**: `PUT /credentials/:id` → replaces credential
- **Impact**: Cannot update credentials on AccountDetailPage
- **Fix**: Add credential update route under platform-accounts

### D-009: Phone Number Create Schema Mismatch (HIGH)
- **Frontend sends**: `{ e164Number, countryCode, nationalNumber, label?, simProvider?, notes? }`
- **Backend expects**: `{ phoneNumber, label?, simProvider?, notes? }`
- **Impact**: Add Number form submission fails validation
- **Fix**: Update `createPhoneSchema` to accept `e164Number`

### D-010: Phone Number Response Shape — Field Name Mismatch (HIGH)
- **Backend returns**: `connectedAccounts` (flat shape with `linkId`, `accountId`, `platform`, etc.)
- **Frontend expects**: `accountLinks` (nested shape with `id`, `platformAccountId`, `platformAccount.platform`, etc.)
- **Impact**: NumberDetailPage shows no connected accounts
- **Fix**: Rename `connectedAccounts` → `accountLinks` and restructure to match frontend `PhoneAccountLink` type

### D-011: Phone Number Response — createdBy/updatedBy Type Mismatch (MEDIUM)
- **Backend returns**: `{ id, fullName }` object for `createdBy`/`updatedBy`
- **Frontend type**: `createdBy: string`, `updatedBy: string`
- **Impact**: TypeScript type mismatch; runtime might work if fields not accessed
- **Fix**: Align types — make both use object or string

### D-012: WhatsApp Session Incomplete Fields (MEDIUM)
- **Frontend expects** (`WhatsAppSession`): `phoneNumberId`, `deviceId`, `createdBy`, `updatedAt`
- **Backend returns** (in `getById`): `id`, `sessionCode`, `status`, `sessionDirectory`, `linkedAt`, `lastOpenedAt`, `lastError`, `device`, `createdAt`
- **Missing**: `phoneNumberId`, `deviceId`, `createdBy`, `updatedAt`
- **Impact**: WhatsAppSection `session.deviceId` is undefined
- **Fix**: Add missing fields to backend response

### D-013: Platform Account Response — Missing hasCredential (MEDIUM)
- **Backend `getById`**: Returns raw `credential` object (includes `passwordCiphertext`, `nonce`, `authTag`)
- **Frontend expects**: `credential.hasCredential: boolean`
- **Impact**: AccountDetailPage always shows "No credentials stored"
- **Fix**: Transform credential to include `hasCredential` and exclude sensitive fields

### D-014: Platform Account list() — create() Response Shape Mismatch (MEDIUM)
- **Backend `create()`**: Returns raw Prisma `PlatformAccount` (no `platform` nested object in response)
- **Frontend `PlatformAccount` type**: expects `platform?: Platform`, `credential?: AccountCredential`, `recoveryMethods?: AccountRecoveryMethod[]`
- **Impact**: Account creation response missing nested data
- **Fix**: Align response shapes

### D-015: Login Response — Missing User Fields (MEDIUM)
- **Backend login**: Returns `{ token, user: { id, email, fullName, role } }`
- **Frontend `AppUser` type**: expects `{ id, fullName, email, role, status, lastLoginAt, createdAt, updatedAt }`
- **Frontend `getProfile`**: Returns `{ id, email, fullName, role, status, lastLoginAt, createdAt }` (missing `updatedAt`)
- **Impact**: User object has missing fields; potential runtime issues
- **Fix**: Add missing fields to login and getProfile responses

### D-016: Pagination Field Name Mismatch (LOW)
- **Backend**: `pagination.totalCount`
- **Frontend type**: `pagination.total`
- **Impact**: Type mismatch; runtime OK (frontend uses `totalPages` which exists in both)
- **Fix**: Standardize on `total` across backend

## Status
- Total defects: 16
- Critical: 4 (D-001, D-002, D-003, D-004)
- High: 5 (D-005, D-006, D-007, D-008, D-009)
- Medium: 5 (D-010, D-011, D-012, D-013, D-014, D-015)
- Low: 1 (D-016)
