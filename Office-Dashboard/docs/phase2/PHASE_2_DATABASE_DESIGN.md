# Phase 2 Database Design — Hair Rap by YOYO
## WhatsApp Session Management Schema

**Version:** 1.0  
**Date:** September 15, 2026  
**Status:** Production Ready

---

## 1. Entity Relationship Diagram (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 1 TABLES (Reference)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐             │
│  │  app_users   │       │ phone_numbers│       │  platforms   │             │
│  │──────────────│       │──────────────│       │──────────────│             │
│  │ id (PK)      │       │ id (PK)      │       │ id (PK)      │             │
│  │ full_name    │       │ e164_number  │       │ slug         │             │
│  │ email        │       │ country_code │       │ display_name │             │
│  │ role         │       │ status       │       │ is_active    │             │
│  └──────────────┘       └──────────────┘       └──────────────┘             │
│         │                       │                                            │
│         │                       │                                            │
└─────────┼───────────────────────┼────────────────────────────────────────────┘
          │                       │
          │                       │
┌─────────┼───────────────────────┼────────────────────────────────────────────┐
│         │     PHASE 2 TABLES    │                                           │
│         │                       │                                           │
│         ▼                       ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    registered_devices                                 │   │
│  │──────────────────────────────────────────────────────────────────────│   │
│  │ id (PK, UUID)                                                        │   │
│  │ device_code (UNIQUE, VARCHAR(20))                                    │   │
│  │ friendly_name (VARCHAR(120))                                         │   │
│  │ hostname (VARCHAR(255), NULLABLE)                                    │   │
│  │ status (ENUM: ONLINE, OFFLINE, UNKNOWN, DISABLED)                   │   │
│  │ launcher_version (VARCHAR(40), NULLABLE)                             │   │
│  │ launcher_api_key_hash (TEXT, NULLABLE)                               │   │
│  │ last_seen_at (TIMESTAMPTZ, NULLABLE)                                 │   │
│  │ enabled (BOOLEAN, DEFAULT true)                                      │   │
│  │ created_by (FK → app_users.id)                                       │   │
│  │ created_at (TIMESTAMPTZ)                                             │   │
│  │ updated_at (TIMESTAMPTZ)                                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │ 1:N                                                               │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    whatsapp_sessions                                  │   │
│  │──────────────────────────────────────────────────────────────────────│   │
│  │ id (PK, UUID)                                                        │   │
│  │ session_code (UNIQUE, VARCHAR(20))                                   │   │
│  │ phone_number_id (UNIQUE FK → phone_numbers.id, CASCADE)              │   │
│  │ device_id (FK → registered_devices.id)                               │   │
│  │ status (ENUM: SETUP_REQUIRED, LINKING, LINKED, ...)                  │   │
│  │ session_directory (VARCHAR(500))                                     │   │
│  │ linked_at (TIMESTAMPTZ, NULLABLE)                                    │   │
│  │ last_opened_at (TIMESTAMPTZ, NULLABLE)                               │   │
│  │ last_error (TEXT, NULLABLE)                                          │   │
│  │ created_by (FK → app_users.id)                                       │   │
│  │ created_at (TIMESTAMPTZ)                                             │   │
│  │ updated_at (TIMESTAMPTZ)                                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │ 1:N                                                               │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    whatsapp_audit_logs                                │   │
│  │──────────────────────────────────────────────────────────────────────│   │
│  │ id (PK, UUID)                                                        │   │
│  │ whatsapp_session_id (FK → whatsapp_sessions.id, NULLABLE)            │   │
│  │ device_id (FK → registered_devices.id, SET NULL)                     │   │
│  │ action (VARCHAR(40), INDEXED)                                        │   │
│  │ actor_user_id (FK → app_users.id, NULLABLE)                          │   │
│  │ metadata (JSONB, DEFAULT '{}')                                       │   │
│  │ ip_address (INET, NULLABLE)                                          │   │
│  │ created_at (TIMESTAMPTZ)                                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Relationship to Phase 1 Tables

### 2.1 Foreign Key Relationships

| Phase 2 Table | Column | References | On Delete | Purpose |
|---------------|--------|------------|-----------|---------|
| `registered_devices` | `created_by` | `app_users.id` | RESTRICT | Track who registered device |
| `whatsapp_sessions` | `phone_number_id` | `phone_numbers.id` | CASCADE | One WA session per phone |
| `whatsapp_sessions` | `device_id` | `registered_devices.id` | RESTRICT | Session assigned to device |
| `whatsapp_sessions` | `created_by` | `app_users.id` | RESTRICT | Track who created session |
| `whatsapp_audit_logs` | `whatsapp_session_id` | `whatsapp_sessions.id` | SET NULL | Audit trail for session |
| `whatsapp_audit_logs` | `device_id` | `registered_devices.id` | SET NULL | Audit trail for device |
| `whatsapp_audit_logs` | `actor_user_id` | `app_users.id` | SET NULL | Track who performed action |

### 2.2 Cardinality Rules

| Relationship | Cardinality | Rule |
|--------------|-------------|------|
| Phone → WhatsApp Session | 1:1 | Each phone can have at most one WA session |
| Device → WhatsApp Sessions | 1:N | Each device can host multiple sessions |
| WhatsApp Session → Audit Logs | 1:N | Each session can have many audit events |
| Device → Audit Logs | 1:N | Each device can have many audit events |

---

## 3. Data Dictionary

### 3.1 `registered_devices`

Stores information about PCs running the Hair Rap launcher application.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | No | `uuid_generate_v4()` | PRIMARY KEY | Unique device identifier |
| `device_code` | VARCHAR(20) | No | - | UNIQUE | Human-readable code (PC-01, PC-02) |
| `friendly_name` | VARCHAR(120) | No | - | - | Display name for the device |
| `hostname` | VARCHAR(255) | Yes | NULL | - | Machine hostname |
| `status` | device_status | No | 'UNKNOWN' | ENUM | Current device status |
| `launcher_version` | VARCHAR(40) | Yes | NULL | - | Installed launcher version |
| `launcher_api_key_hash` | TEXT | Yes | NULL | - | Hashed API key (raw shown once) |
| `last_seen_at` | TIMESTAMPTZ | Yes | NULL | - | Last heartbeat timestamp |
| `enabled` | BOOLEAN | No | true | - | Whether device is enabled |
| `created_by` | UUID | No | - | FK → app_users | User who registered device |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | - | Record creation time |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | - | Last update time |

**Indexes:**
- `device_code` (UNIQUE)
- `created_by` (FK index)

**Design Note — Single-Device-Per-Launcher Model:**
This implementation stores `launcher_api_key_hash` directly on the `registered_devices` table rather than using a separate `launcher_pairings` table (as described in some Phase 2 documentation variants). Each device has exactly one launcher API key. The raw API key is generated by the dashboard (either during admin registration or launcher self-registration) and shown to the user exactly once; only the SHA-256 hash is persisted. The launcher stores the raw key in `launcher_config.json` on the local filesystem. This simplification was chosen over a pairing-code flow for a simpler deployment model — one device record per launcher PC.

**Enum Values (`device_status`):**
| Value | Description |
|-------|-------------|
| `ONLINE` | Device is responding to heartbeats |
| `OFFLINE` | Device missed 2+ heartbeats |
| `UNKNOWN` | Initial state, no heartbeat yet |
| `DISABLED` | Manually disabled by admin |

### 3.2 `whatsapp_sessions`

Maps phone numbers to WhatsApp Web sessions on specific devices.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | No | `uuid_generate_v4()` | PRIMARY KEY | Unique session identifier |
| `session_code` | VARCHAR(20) | No | - | UNIQUE | Auto-generated code (HR-WA-0001) |
| `phone_number_id` | UUID | No | - | UNIQUE, FK → phone_numbers (CASCADE) | Associated phone number |
| `device_id` | UUID | No | - | FK → registered_devices | Assigned device |
| `status` | whatsapp_session_status | No | 'SETUP_REQUIRED' | ENUM | Current session status |
| `session_directory` | VARCHAR(500) | No | - | - | Chrome user-data directory path |
| `linked_at` | TIMESTAMPTZ | Yes | NULL | - | When QR was scanned successfully |
| `last_opened_at` | TIMESTAMPTZ | Yes | NULL | - | Last time session was launched |
| `last_error` | TEXT | Yes | NULL | - | Most recent error message |
| `created_by` | UUID | No | - | FK → app_users | User who created session |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | - | Record creation time |
| `updated_at` | TIMESTAMPTZ | No | `NOW()` | - | Last update time |

**Indexes:**
- `session_code` (UNIQUE)
- `phone_number_id` (UNIQUE)
- `device_id` (FK index)
- `created_by` (FK index)

**Enum Values (`whatsapp_session_status`):**
| Value | Description |
|-------|-------------|
| `SETUP_REQUIRED` | New session, needs QR scan |
| `LINKING` | Chrome open, waiting for QR scan |
| `LINKED` | Session authenticated and active |
| `RELOGIN_REQUIRED` | Session expired, needs re-linking |
| `DISABLED` | Manually disabled by admin |
| `ERROR` | Error occurred during setup/linking |
| `UNKNOWN` | Status cannot be determined |

### 3.3 `whatsapp_audit_logs`

Audit trail for all WhatsApp session and device events.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | No | `uuid_generate_v4()` | PRIMARY KEY | Unique event identifier |
| `whatsapp_session_id` | UUID | Yes | NULL | FK → whatsapp_sessions | Related session |
| `device_id` | UUID | Yes | NULL | FK → registered_devices (SET NULL) | Related device |
| `action` | VARCHAR(40) | No | - | INDEXED | Event type |
| `actor_user_id` | UUID | Yes | NULL | FK → app_users | User who performed action |
| `metadata` | JSONB | No | '{}' | - | Sanitized event context |
| `ip_address` | INET | Yes | NULL | - | Source IP address |
| `created_at` | TIMESTAMPTZ | No | `NOW()` | - | Event timestamp |

**Indexes:**
- `created_at` (for time-range queries)
- `action` (for filtering by event type)
- `whatsapp_session_id` (FK index)
- `device_id` (FK index)
- `actor_user_id` (FK index)

---

## 4. Indexes and Constraints

### 4.1 Index Summary

| Table | Index Name | Columns | Type | Purpose |
|-------|------------|---------|------|---------|
| `registered_devices` | `registered_devices_pkey` | `id` | PRIMARY | PK lookup |
| `registered_devices` | `registered_devices_device_code_key` | `device_code` | UNIQUE | Code lookup |
| `whatsapp_sessions` | `whatsapp_sessions_pkey` | `id` | PRIMARY | PK lookup |
| `whatsapp_sessions` | `whatsapp_sessions_session_code_key` | `session_code` | UNIQUE | Code lookup |
| `whatsapp_sessions` | `whatsapp_sessions_phone_number_id_key` | `phone_number_id` | UNIQUE | Phone lookup |
| `whatsapp_audit_logs` | `whatsapp_audit_logs_pkey` | `id` | PRIMARY | PK lookup |
| `whatsapp_audit_logs` | `idx_wa_audit_logs_created_at` | `created_at` | BTREE | Time queries |
| `whatsapp_audit_logs` | `idx_wa_audit_logs_action` | `action` | BTREE | Action filtering |

### 4.2 Constraint Summary

| Table | Constraint | Type | Definition |
|-------|------------|------|------------|
| `registered_devices` | `registered_devices_device_code_key` | UNIQUE | `device_code` |
| `whatsapp_sessions` | `whatsapp_sessions_session_code_key` | UNIQUE | `session_code` |
| `whatsapp_sessions` | `whatsapp_sessions_phone_number_id_key` | UNIQUE | `phone_number_id` |
| `whatsapp_sessions` | `whatsapp_sessions_phone_number_id_fkey` | FK | `phone_number_id` → `phone_numbers.id` (CASCADE) |
| `whatsapp_sessions` | `whatsapp_sessions_device_id_fkey` | FK | `device_id` → `registered_devices.id` |
| `whatsapp_sessions` | `whatsapp_sessions_created_by_fkey` | FK | `created_by` → `app_users.id` |
| `whatsapp_audit_logs` | `whatsapp_audit_logs_whatsapp_session_id_fkey` | FK | `whatsapp_session_id` → `whatsapp_sessions.id` |
| `whatsapp_audit_logs` | `whatsapp_audit_logs_device_id_fkey` | FK | `device_id` → `registered_devices.id` (SET NULL) |
| `whatsapp_audit_logs` | `whatsapp_audit_logs_actor_user_id_fkey` | FK | `actor_user_id` → `app_users.id` |

---

## 5. Lifecycle State Machine

### 5.1 WhatsApp Session Status Lifecycle

```
                              ┌─────────────┐
                              │   UNKNOWN   │
                              └─────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                    ┌─────────│SETUP_REQUIRED│─────────┐
                    │         └─────────────┘          │
                    │                │                  │
                    │                ▼                  │
                    │         ┌─────────────┐          │
                    │         │   LINKING   │          │
                    │         └─────────────┘          │
                    │                │                  │
                    │      ┌─────────┴─────────┐       │
                    │      ▼                   ▼       │
                    │ ┌──────────┐       ┌──────────┐  │
                    │ │  LINKED  │       │  ERROR   │  │
                    │ └──────────┘       └──────────┘  │
                    │      │                   │       │
                    │      ▼                   │       │
                    │ ┌──────────────┐         │       │
                    │ │RELOGIN_      │◄────────┘       │
                    │ │REQUIRED      │                 │
                    │ └──────────────┘                 │
                    │      │                           │
                    └──────┼───────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  DISABLED   │
                    └─────────────┘
```

### 5.2 Valid State Transitions

| From | To | Trigger | Allowed By |
|------|----|---------|------------|
| `SETUP_REQUIRED` | `LINKING` | User clicks "Setup WhatsApp" | Admin, Editor |
| `LINKING` | `LINKED` | Launcher confirms QR scan | Launcher |
| `LINKING` | `ERROR` | Launcher reports error | Launcher |
| `LINKING` | `RELOGIN_REQUIRED` | Timeout or session expired | System |
| `LINKED` | `RELOGIN_REQUIRED` | Session expired | System |
| `LINKED` | `DISABLED` | User disables session | Admin, Editor |
| `LINKED` | `SETUP_REQUIRED` | User changes device | Admin, Editor |
| `RELOGIN_REQUIRED` | `LINKING` | User clicks "Reconnect" | Admin, Editor |
| `ERROR` | `SETUP_REQUIRED` | User clicks "Retry Setup" | Admin, Editor |
| `ERROR` | `LINKING` | User clicks "Reconnect" | Admin, Editor |
| `DISABLED` | `SETUP_REQUIRED` | User re-enables session | Admin, Editor |

### 5.3 Device Status Lifecycle

```
                    ┌─────────────┐
         ┌─────────│   UNKNOWN   │─────────┐
         │         └─────────────┘          │
         │                │                  │
         │                ▼                  │
         │         ┌─────────────┐          │
         │         │   ONLINE    │          │
         │         └─────────────┘          │
         │                │                  │
         │                ▼                  │
         │         ┌─────────────┐          │
         │         │   OFFLINE   │          │
         │         └─────────────┘          │
         │                │                  │
         └────────────────┼──────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  DISABLED   │
                   └─────────────┘
```

### 5.4 Valid Device State Transitions

| From | To | Trigger |
|------|----|---------|
| `UNKNOWN` | `ONLINE` | First heartbeat received |
| `ONLINE` | `OFFLINE` | Missed 2+ heartbeats |
| `OFFLINE` | `ONLINE` | Heartbeat received |
| `ONLINE` | `DISABLED` | Admin disables device |
| `OFFLINE` | `DISABLED` | Admin disables device |
| `DISABLED` | `UNKNOWN` | Admin re-enables device |

---

## 6. Naming Conventions

### 6.1 Table Names

- Plural nouns: `registered_devices`, `whatsapp_sessions`
- Snake_case: `whatsapp_audit_logs`
- Prefix for related tables: `whatsapp_` for WhatsApp-specific tables

### 6.2 Column Names

- Snake_case: `device_code`, `session_directory`
- Foreign keys: `{referenced_table_singular}_id` (e.g., `phone_number_id`)
- Timestamps: `{action}_at` (e.g., `created_at`, `linked_at`)
- Booleans: `is_{adjective}` or `{adjective}` (e.g., `enabled`, `is_primary`)

### 6.3 Index Names

- Pattern: `idx_{table}_{column(s)}`
- Example: `idx_wa_audit_logs_created_at`

### 6.4 Constraint Names

- Primary keys: `{table}_pkey`
- Foreign keys: `{table}_{column}_fkey`
- Unique: `{table}_{column}_key`

---

## 7. Data Integrity Rules

### 7.1 Cascading Rules

| Relationship | On Delete | Rationale |
|--------------|-----------|-----------|
| Phone → WA Session | CASCADE | Session dies with phone |
| Device → WA Audit Logs | SET NULL | Preserve audit trail |
| Session → WA Audit Logs | - | Preserve audit trail |

### 7.2 Business Rules

1. **One session per phone**: `phone_number_id` is UNIQUE in `whatsapp_sessions`
2. **Session code format**: `HR-WA-XXXX` where XXXX is 4+ digits
3. **Device code format**: `PC-XX` where XX is 2-digit number
4. **Session directory**: Must be under `C:\HairRap\WhatsAppSessions\`
5. **API key hash**: Only hash stored, raw key shown once

### 7.3 Validation Rules

| Field | Validation |
|-------|------------|
| `device_code` | Pattern: `^PC-\d{2,}$` |
| `session_code` | Pattern: `^HR-WA-\d{4,}$` |
| `session_directory` | Starts with `C:\HairRap\WhatsAppSessions\` |
| `e164_number` | Pattern: `^\+\d{10,15}$` |

---

## 8. Performance Considerations

### 8.1 Query Patterns

| Query | Index Used | Expected Performance |
|-------|------------|---------------------|
| Get device by code | `device_code` UNIQUE | < 1ms |
| Get session by phone | `phone_number_id` UNIQUE | < 1ms |
| Get sessions by device | `device_id` FK | < 10ms |
| Get audit logs by session | `whatsapp_session_id` FK | < 10ms |
| Get audit logs by date range | `created_at` BTREE | < 100ms |
| Get audit logs by action | `action` BTREE | < 100ms |

### 8.2 Scaling Recommendations

1. **Partitioning**: Consider partitioning `whatsapp_audit_logs` by `created_at` for large datasets
2. **Archiving**: Archive old audit logs (> 1 year) to separate table
3. **Connection pooling**: Use PgBouncer for high-concurrency scenarios
4. **Read replicas**: Use read replicas for reporting queries

---

## 9. Security Considerations

### 9.1 Sensitive Data

| Field | Sensitivity | Protection |
|-------|-------------|------------|
| `launcher_api_key_hash` | High | SHA-256 hash of API key (raw key shown once) |
| `last_error` | Medium | May contain error details |
| `metadata` | Medium | Sanitized before storage |
| `ip_address` | Medium | Stored for audit purposes |

### 9.2 Access Control

- **Admin**: Full access to all tables
- **Editor**: Read/write sessions, read devices
- **Viewer**: Read-only access
- **Launcher**: API key auth, limited to own device operations

---

## 10. Migration Strategy

### 10.1 Phase 1 to Phase 2 Migration

1. **No Phase 1 modifications**: Phase 2 is purely additive
2. **New tables only**: 3 new tables added
3. **New enums only**: 2 new enums added
4. **Foreign keys**: Reference existing Phase 1 tables
5. **Indexes**: New indexes for Phase 2 tables only

### 10.2 Rollback Strategy

1. Drop Phase 2 tables in reverse dependency order
2. Drop Phase 2 enums
3. Phase 1 data remains intact

### 10.3 Data Migration

- **No data migration required**: Phase 2 starts empty
- **Seed data**: None required (devices/sessions created via UI)
- **Test data**: Can be created via API or UI

---

## 11. Testing Considerations

### 11.1 Test Scenarios

| Scenario | Tables Affected | Validation |
|----------|-----------------|------------|
| Create device | `registered_devices` | Record exists, status=UNKNOWN |
| Device heartbeat | `registered_devices` | `last_seen_at` updated, status=ONLINE |
| Create session | `whatsapp_sessions` | Record exists, status=SETUP_REQUIRED |
| Link session | `whatsapp_sessions` | status=LINKED, `linked_at` set |
| Disable session | `whatsapp_sessions` | status=DISABLED |
| Delete phone | `whatsapp_sessions` | Session CASCADE deleted |

### 11.2 Edge Cases

1. **Duplicate device code**: Should fail with UNIQUE constraint error
2. **Duplicate session for phone**: Should fail with UNIQUE constraint error
3. **Delete device with sessions**: Should fail (RESTRICT) or handle gracefully
4. **Concurrent updates**: Optimistic locking via `updated_at`

---

## 12. Appendix

### A. Complete Prisma Schema (Phase 2)

```prisma
enum DeviceStatus {
  ONLINE
  OFFLINE
  UNKNOWN
  DISABLED
}

enum WhatsAppSessionStatus {
  SETUP_REQUIRED
  LINKING
  LINKED
  RELOGIN_REQUIRED
  DISABLED
  ERROR
  UNKNOWN
}

model RegisteredDevice {
  id                 String       @id @default(uuid()) @db.Uuid
  deviceCode         String       @unique @map("device_code") @db.VarChar(20)
  friendlyName       String       @map("friendly_name") @db.VarChar(120)
  hostname           String?      @db.VarChar(255)
  status             DeviceStatus @default(UNKNOWN)
  launcherVersion    String?      @map("launcher_version") @db.VarChar(40)
  launcherApiKeyHash String?      @map("launcher_api_key_hash")
  lastSeenAt         DateTime?    @map("last_seen_at") @db.Timestamptz()
  enabled            Boolean      @default(true)
  createdBy          String       @map("created_by") @db.Uuid
  createdAt          DateTime     @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt          DateTime     @updatedAt @map("updated_at") @db.Timestamptz()

  creator        AppUser           @relation("DeviceCreatedBy", fields: [createdBy], references: [id])
  whatsappSessions WhatsappSession[]
  waAuditLogs    WhatsappAuditLog[]

  @@map("registered_devices")
}

model WhatsappSession {
  id               String                @id @default(uuid()) @db.Uuid
  sessionCode      String                @unique @map("session_code") @db.VarChar(20)
  phoneNumberId    String                @unique @map("phone_number_id") @db.Uuid
  deviceId         String                @map("device_id") @db.Uuid
  status           WhatsAppSessionStatus @default(SETUP_REQUIRED)
  sessionDirectory String                @map("session_directory") @db.VarChar(500)
  linkedAt         DateTime?             @map("linked_at") @db.Timestamptz()
  lastOpenedAt     DateTime?             @map("last_opened_at") @db.Timestamptz()
  lastError        String?               @map("last_error")
  createdBy        String                @map("created_by") @db.Uuid
  createdAt        DateTime              @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt        DateTime              @updatedAt @map("updated_at") @db.Timestamptz()

  phoneNumber PhoneNumber       @relation(fields: [phoneNumberId], references: [id], onDelete: Cascade)
  device      RegisteredDevice  @relation(fields: [deviceId], references: [id])
  creator     AppUser           @relation("WaSessionCreatedBy", fields: [createdBy], references: [id])
  auditLogs   WhatsappAuditLog[]

  @@map("whatsapp_sessions")
}

model WhatsappAuditLog {
  id                String   @id @default(uuid()) @db.Uuid
  whatsappSessionId String?  @map("whatsapp_session_id") @db.Uuid
  deviceId          String?  @map("device_id") @db.Uuid
  action            String
  actorUserId       String?  @map("actor_user_id") @db.Uuid
  metadata          Json     @default("{}")
  ipAddress         String?  @map("ip_address") @db.Inet()
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz()

  whatsappSession WhatsappSession? @relation(fields: [whatsappSessionId], references: [id])
  device          RegisteredDevice? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  @@index([createdAt], map: "idx_wa_audit_logs_created_at")
  @@index([action], map: "idx_wa_audit_logs_action")
  @@map("whatsapp_audit_logs")
}
```

### B. SQL DDL (PostgreSQL)

See `database/SUPABASE_MANUAL_SETUP.sql` for complete DDL.

---

## References

- [Phase 2 Contract](../phase2_contract.md)
- [Architecture Document](./PHASE_2_ARCHITECTURE.md)
- [Launcher Specification](./PHASE_2_LAUNCHER_SPEC.md)

