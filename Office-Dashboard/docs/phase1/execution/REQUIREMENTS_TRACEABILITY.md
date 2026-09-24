# Phase 1 Requirements Traceability Matrix

Maintained by the Hermes orchestrator. Every row must end with concrete evidence
(file/test/command) before completion may be declared.

**Evidence legend:** `U` unit test · `I` integration/API test · `S` security test ·
`E` E2E test · `D` DB constraint/SQL proof · `M` manual scripted UAT · `C` config/artefact

---

## 1. Functional requirements (handoff §5)

| ID | Requirement | Owner | Verification | Status |
|---|---|---|---|---|
| FR-001 | Create phone record; E.164 normalisation; duplicates rejected | Backend | `U:phone-normalisation` `I:POST /phone-numbers` `D:UNIQUE(e164_number)` | pending |
| FR-002 | Edit provider, label, status, non-secret notes | Backend+Frontend | `I:PATCH /phone-numbers/:id` `E:edit number flow` | pending |
| FR-003 | Archive + restore; archived excluded from default lists | Backend+Frontend | `I:archive/restore` `E:UAT-11` | pending |
| FR-004 | Create platform account linked to ≥1 phone | Backend+Frontend | `I:POST /platform-accounts` transaction test | pending |
| FR-005 | Link existing account to another number without duplicating | Backend+Frontend | `I:account-links` `E:UAT-04` | pending |
| FR-006 | Unlink account without deleting the account | Backend | `I:DELETE account-links/:linkId` + row still exists | pending |
| FR-007 | Set/replace password; encrypted before persistence | Backend | `U:crypto round-trip` `I:PUT credential` `S:no plaintext at rest` | pending |
| FR-008 | Reveal one password at a time; audited; no-store | Backend+Frontend | `S:reveal` `E:UAT-13` `I:no-store header` | pending |
| FR-009 | Add/edit/remove recovery email/phone | Backend+Frontend | `I:recovery CRUD` `E:UAT-07` | pending |
| FR-010 | Search by number, handle, display name, login identifier | Backend+Frontend | `I:search matrix` `E:UAT-09` | pending |
| FR-011 | Filter by platform, phone status, account status, completeness | Backend+Frontend | `I:filter matrix` `E:UAT-10` | pending |
| FR-012 | Derive Complete/Partial + show missing items | Shared+Both | `U:completeness` `E:UAT-08` | pending |
| FR-013 | ADMIN creates users, changes role/status; disabled blocks access | Backend+Frontend | `S:disabled user` `E:UAT-14` | pending |
| FR-014 | Audit every material create/update/archive/restore/link/unlink/credential/recovery/user event | Backend | `I:audit coverage per endpoint` | pending |
| FR-015 | Dashboard totals from DB, not cached counts | Backend | `I:reconcile vs raw SQL` `E:UAT-12` | pending |
| FR-016 | Server-side pagination on all list endpoints | Backend+Frontend | `I:page/pageSize/total` `D:MAX_PAGE_SIZE` | pending |
| FR-017 | Masking on overview surfaces; full value in authorised detail | Frontend+Shared | `U:mask helpers` `E:list vs detail` | pending |
| FR-018 | Stale-write detection / latest `updated_at` returned | Backend+Frontend | `I:If-Match → 409 STALE_WRITE` | pending |

## 2. Scope guardrails (must be ABSENT — handoff §2.2, directive §14)

| ID | Prohibition | Verification | Status |
|---|---|---|---|
| EX-01 | No Teams / departments / team filters anywhere | `S:grep + route scan` `E:UAT-15` | pending |
| EX-02 | No 2FA/OTP/authenticator/backup-code functionality | `S:grep + route scan` | pending |
| EX-03 | No social platform OAuth/API integration | `S:no outbound HTTP client in src` | pending |
| EX-04 | No automatic status check / live health monitoring | `S:grep "health" in UI copy` `E:UAT-16` | pending |
| EX-05 | No posting/scheduling/content calendar/comments/inbox/analytics | `S:route scan` | pending |
| EX-06 | No automatic login or password rotation | `S:grep` | pending |
| EX-07 | No bulk password reveal or export | `S:route scan + UI scan` `E:UAT-05` | pending |
| EX-08 | No fixed quantity limit on numbers (UI/API/DB) | `D:no CHECK/CAP constant` `I:create >100 records` | pending |
| EX-09 | Profile Completeness never labelled "Health" | `S:string scan` | pending |

## 3. Security requirements (handoff §10)

| ID | Requirement | Verification | Status |
|---|---|---|---|
| SEC-01 | AES-256-GCM application-layer encryption of external passwords | `U:crypto` `D:column types` | pending |
| SEC-02 | No plaintext external password at rest | `S:bytea scan for plaintext` `D:only ciphertext cols exist` | pending |
| SEC-03 | Encryption key outside PostgreSQL + outside source control | `C:.env.example` `S:git grep key material` | pending |
| SEC-04 | AAD = platform_account_id; ciphertext not movable between accounts | `U:wrong-AAD negative` | pending |
| SEC-05 | key_version rotation supported, re-encrypt without schema change | `U:multi-version key ring` `C:runbook rotation` | pending |
| SEC-06 | Credential Service is the only decryption path | `S:code audit` `U:` | pending |
| SEC-07 | Normal list/detail payloads contain no credential material | `S:payload deep-scan` | pending |
| SEC-08 | Dedicated authorised reveal endpoint (POST, never GET) | `S:route inventory` `I:` | pending |
| SEC-09 | Reveal audited with actor/IP/user-agent, secret never stored | `I:audit row after reveal` | pending |
| SEC-10 | Reveal response `Cache-Control: no-store` | `I:header assertion` | pending |
| SEC-11 | Dashboard login passwords one-way hashed (not encrypted) | `U:hash format` | pending |
| SEC-12 | Log/audit/error secret redaction | `U:redactor` `S:captured logs scanned` | pending |
| SEC-13 | Server-side RBAC; UI hiding is not authorisation | `S:direct API as each role` | pending |
| SEC-14 | Viewer cannot reveal/set/edit/modify anything | `S:negative matrix` `E:UAT-06` | pending |
| SEC-15 | Disabled user loses access immediately | `S:` `E:UAT-14` | pending |
| SEC-16 | Rate limits on login and reveal | `I:429 after threshold` | pending |
| SEC-17 | CSRF protection for cookie-based state changes | `I:bad Origin → 403` | pending |
| SEC-18 | Security headers / CSP | `I:header assertions` | pending |
| SEC-19 | No plaintext credential persisted in browser storage | `E:storage scan after reveal` | pending |
| SEC-20 | Audit log append-only (no update/delete path or API) | `D:trigger + revoke` `S:attempts fail` | pending |
| SEC-21 | Injection/XSS safety on text + URL fields | `S:payload probes` | pending |
| SEC-22 | Least-privilege runtime DB role | `D:grants` `C:runbook` | pending |

## 4. Database requirements (handoff §12, architecture §7/§15)

| ID | Requirement | Verification | Status |
|---|---|---|---|
| DB-01 | All 8 entities with documented columns/types/nullability | `D:SQL + Prisma drift check` | pending |
| DB-02 | All 6 enums with exact label sets | `D:pg_enum assertion` | pending |
| DB-03 | `UNIQUE(e164_number)` | `D:` `I:` | pending |
| DB-04 | Partial index for non-archived phone records | `D:` | pending |
| DB-05 | `platform_accounts` composite + login_identifier indexes | `D:` | pending |
| DB-06 | `UNIQUE(platform_id, external_account_id)` when known | `D:` `I:` | pending |
| DB-07 | `UNIQUE(phone_number_id, platform_account_id, relationship_type)` + FK indexes | `D:` `I:` | pending |
| DB-08 | `UNIQUE(platform_account_id)` on `account_credentials` | `D:` `I:` | pending |
| DB-09 | `account_recovery_methods` indexes | `D:` | pending |
| DB-10 | `audit_logs` three documented indexes | `D:` | pending |
| DB-11 | Fresh-DB migration runs from zero | `I:migrate deploy on scratch` | pending |
| DB-12 | FK integrity enforced (no orphan links) | `D:` `I:negative inserts` | pending |
| DB-13 | SQL/Prisma synchronisation proven automatically | `D:migrate diff bidirectional` | pending |
| DB-14 | Seven platforms seeded, `is_active=true` | `D:` `I:GET /platforms` | pending |
| DB-15 | Zero phone / account / credential rows in release state | `D:count=0 assertions` | pending |
| DB-16 | Rollback validated safely on a disposable DB | `D:ROLLBACK run` | pending |

## 5. Frontend requirements (handoff §6, §7, §19)

| ID | Requirement | Verification | Status |
|---|---|---|---|
| FE-01 | Navigation = Dashboard, Phone Numbers, Connected Accounts, Users & Access, Audit Logs | `E:` | pending |
| FE-02 | Dashboard cards + quick add + real metrics | `E:` `U:` | pending |
| FE-03 | Number list with documented columns | `U:` | pending |
| FE-04 | Add/Edit Number form with §7.1 rules, inline duplicate error | `E:UAT-01/02` | pending |
| FE-05 | Number 360 with accounts, add/link/unlink | `E:UAT-03/04` | pending |
| FE-06 | Account detail: identity, numbers, credential state, recovery, audit snippet | `E:` | pending |
| FE-07 | Credential set/replace/reveal/copy inside single-account context only | `E:UAT-05` | pending |
| FE-08 | Passwords masked by default; explicit confirmation before reveal | `E:` `U:` | pending |
| FE-09 | Recovery email/phone CRUD UX | `E:UAT-07` | pending |
| FE-10 | Manual account statuses exactly the documented five | `U:` | pending |
| FE-11 | Profile Completeness + missing items, never "Health" | `E:UAT-08` | pending |
| FE-12 | Server-backed search/filter/sort/pagination with debounced search | `E:UAT-09/10` | pending |
| FE-13 | Users & Access admin UI, no Teams | `E:UAT-15` | pending |
| FE-14 | Audit log UI with documented filters, no secret values | `E:UAT-13` | pending |
| FE-15 | §6.11 common states: loading/empty/no-results/validation/API error/403/archive-confirm/unsaved | `U:` `E:` | pending |
| FE-16 | Responsive ≥1024px and tablet widths; no hidden core actions | `U:` + CSS review | pending |
| FE-17 | Accessibility: labels, keyboard, focus management, semantic tables | `U:a11y assertions` | pending |
| FE-18 | Platform icons from `icon_key`/slug mapping, no hard-coded business data | `U:` | pending |
| FE-19 | External profile URLs open new tab with safe `rel` | `U:` | pending |
| FE-20 | Role-aware disable/hide while backend stays authoritative | `U:` `S:` | pending |

## 6. API contract requirements (handoff §14, §17)

| ID | Requirement | Verification | Status |
|---|---|---|---|
| API-01 | All documented endpoints exist under `/api/v1` | `I:route inventory test` | pending |
| API-02 | Success envelope `{data, meta.requestId}` | `I:` | pending |
| API-03 | List envelope with page/pageSize/total/totalPages | `I:` | pending |
| API-04 | Error envelope `{error:{code,message,fieldErrors?,requestId}}` | `I:` | pending |
| API-05 | Appendix B stable codes with correct HTTP statuses | `I:` per code | pending |
| API-06 | 204 for unlink/remove; 201 for create | `I:` | pending |
| API-07 | Unsupported sort field rejected | `I:` | pending |
| API-08 | Transactions: create+link+credential+recovery atomic | `I:rollback proof` | pending |
| API-09 | No raw Prisma/stack traces surfaced | `S:` | pending |

## 7. Testing strategy (handoff §22)

| ID | Requirement | Status |
|---|---|---|
| T-01 | Unit: phone normalisation + duplicate detection | pending |
| T-02 | Unit: Profile Completeness calculation | pending |
| T-03 | Unit: RBAC permission policy | pending |
| T-04 | Unit: encrypt/decrypt round trip + wrong-AAD + wrong key version | pending |
| T-05 | Unit: DTO mapping never exposes credential material | pending |
| T-06 | Unit: audit metadata sanitizer/redaction | pending |
| T-07 | Integration: phone create/edit/archive/restore vs test DB | pending |
| T-08 | Integration: account create/link/unlink + duplicate protection | pending |
| T-09 | Integration: credential set/replace/reveal with role checks + audit | pending |
| T-10 | Integration: recovery CRUD | pending |
| T-11 | Integration: list filtering/pagination/search | pending |
| T-12 | Integration: user disable prevents access | pending |
| T-13 | E2E: admin adds number + account with credential | pending |
| T-14 | E2E: editor maintains/reveals, viewer cannot edit/reveal | pending |
| T-15 | E2E: search number/account | pending |
| T-16 | E2E: archive and restore | pending |
| T-17 | E2E: partial completeness shows exact missing items | pending |
| T-18 | E2E: revealed plaintext disappears after modal close/navigation | pending |
| T-19 | E2E: audit log shows reveal event but not the secret | pending |
| T-20 | Security: Viewer direct API reveal blocked | pending |
| T-21 | Security: ciphertext absent from normal payloads | pending |
| T-22 | Security: secrets absent from logs + audit metadata | pending |
| T-23 | Security: reveal is no-store | pending |
| T-24 | Security: rate limits on login + reveal | pending |
| T-25 | Security: injection/XSS probes on text + URL fields | pending |

## 8. UAT acceptance criteria (handoff §23)

| ID | Criterion | Verification | Status |
|---|---|---|---|
| UAT-01 | Add valid new number and immediately find it | scripted UAT + `E` | pending |
| UAT-02 | Duplicate normalised number blocked with clear message | scripted UAT + `E` | pending |
| UAT-03 | One number can hold accounts from all seven platforms | scripted UAT + `I` | pending |
| UAT-04 | Account linked to another number without duplication | scripted UAT + `I` | pending |
| UAT-05 | Password stored, masked by default, revealed only by authorised role | scripted UAT + `S` | pending |
| UAT-06 | Viewer cannot reveal or modify password via direct API | scripted UAT + `S` | pending |
| UAT-07 | Recovery email/phone added and edited | scripted UAT | pending |
| UAT-08 | Completeness Complete only when all checks pass; lists missing otherwise | scripted UAT | pending |
| UAT-09 | Search by phone, handle, login email/identifier, display name | scripted UAT | pending |
| UAT-10 | Platform/status/completeness filters correct | scripted UAT | pending |
| UAT-11 | Archive removes from default list; restore returns without losing links/audit | scripted UAT | pending |
| UAT-12 | Dashboard totals match direct DB truth | scripted UAT + `I` | pending |
| UAT-13 | Reveal creates audit event with actor/time but no secret | scripted UAT + `S` | pending |
| UAT-14 | Disabled user can no longer access dashboard/API | scripted UAT + `S` | pending |
| UAT-15 | No Teams or 2FA controls anywhere in Phase 1 UI | scripted UAT + `S` | pending |
| UAT-16 | No platform API call or automatic health claim | scripted UAT + `S` | pending |

## 9. Definition of Done (handoff §25)

| ID | DoD item | Status |
|---|---|---|
| DOD-01 | Migrations create all entities/constraints/indexes and run cleanly on a fresh DB | pending |
| DOD-02 | All scoped screens and APIs implemented against real DB data; no mocked production flows | pending |
| DOD-03 | All seven platforms seeded and selectable | pending |
| DOD-04 | RBAC enforced server-side and covered by tests | pending |
| DOD-05 | External passwords encrypted before persistence; none plaintext at rest | pending |
| DOD-06 | Reveal dedicated, authorised, audited, no-store, ephemeral in frontend | pending |
| DOD-07 | No secret in normal payloads, logs, audit metadata or error traces | pending |
| DOD-08 | Archive/restore without relationship/audit loss | pending |
| DOD-09 | Profile Completeness exactly per rules and never labelled health | pending |
| DOD-10 | Search/filter/sort/pagination server-side | pending |
| DOD-11 | Dashboard metrics reconcile with DB queries | pending |
| DOD-12 | Audit log covers every required material event | pending |
| DOD-13 | §22 unit/integration/E2E/security tests pass | pending |
| DOD-14 | §23 UAT criteria signed off | pending |
| DOD-15 | Staging verification + production config + backup/restore documented | pending (staging deploy itself is human-gated) |
| DOD-16 | No out-of-scope Teams/2FA/posting/scheduling/analytics/live-monitoring leakage | pending |

## 10. DevOps / release gates

| ID | Requirement | Verification | Status |
|---|---|---|---|
| OPS-01 | `SUPABASE_MANUAL_SETUP.sql` complete, ordered, commented, locally executed | `D` | pending |
| OPS-02 | `SUPABASE_VERIFY.sql` passes against the setup-applied DB | `D` | pending |
| OPS-03 | `SUPABASE_ROLLBACK.sql` validated on a disposable DB | `D` | pending |
| OPS-04 | SQL ⇄ Prisma synchronisation proven bidirectionally | `D:migrate diff` | pending |
| OPS-05 | CI workflow defines install/lint/typecheck/build/tests/migrations | `C` | pending |
| OPS-06 | `.env.example` documents every config category without secrets | `C` | pending |
| OPS-07 | Backup + tested restore procedure | `C` + script run | pending |
| OPS-08 | Human release runbook (Git push + hosted Supabase) | `C` | pending |
| OPS-09 | No agent pushed to remote Git or touched hosted Supabase | `git remote -v` evidence | pending |
| OPS-10 | Final status `READY_FOR_HUMAN_RELEASE` | report | pending |

---