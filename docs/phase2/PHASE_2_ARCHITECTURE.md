# Phase 2 Architecture — Hair Rap by YOYO
## WhatsApp Session Management

**Version:** 1.0  
**Date:** September 15, 2026  
**Status:** Production Ready

---

## 1. Executive Summary

Phase 2 extends Hair Rap's phone number management system with WhatsApp Web session management. It enables the team to manage WhatsApp sessions across multiple PCs, track session status, and automate session setup through a secure launcher application.

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Hair Rap Dashboard (Web)                          │
│                          http://localhost:3000                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ REST API
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend API Server                                │
│                           /api/v1/*                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Auth      │  │   Phones    │  │  Accounts   │  │  WhatsApp   │        │
│  │   Module    │  │   Module    │  │   Module    │  │   Module    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Prisma ORM
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PostgreSQL Database                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Phase 1    │  │  Phase 2    │  │   Audit     │  │   Indexes   │        │
│  │   Tables    │  │   Tables    │  │    Logs     │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
         ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
         │   PC-01     │     │   PC-02     │     │   PC-03     │
         │  Launcher   │     │  Launcher   │     │  Launcher   │
         └─────────────┘     └─────────────┘     └─────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
         ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
         │  Chrome     │     │  Chrome     │     │  Chrome     │
         │  Sessions   │     │  Sessions   │     │  Sessions   │
         └─────────────┘     └─────────────┘     └─────────────┘
```

### 2.2 Component Layers

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14, React, Tailwind CSS | User interface for managing phones and WhatsApp sessions |
| API Server | Express.js, TypeScript | REST API for all operations |
| Database | PostgreSQL (Supabase) | Persistent storage with RLS |
| Launcher | Python 3.11+ | Windows application for launching WhatsApp sessions |
| Browser | Chrome/Edge | WhatsApp Web sessions with isolated profiles |

---

## 3. Component Diagram

### 3.1 Frontend Components (Phase 2 Additions)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard Page                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ WhatsApp Stats Card                                        │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │ │ Linked  │ │ Setup   │ │ Error   │ │ Offline │          │  │
│  │ │   12    │ │   5     │ │   2     │ │   3     │          │  │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Devices Page (NEW)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Register Device │ Enable/Disable │ View Status            │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Code │ Name │ Status │ Last Seen │ Version │ Actions      │  │
│  │ PC-01│ Main │ ONLINE │ 2min ago  │ 1.0.0   │ [Edit] [Off] │  │
│  │ PC-02│ Back │ OFFLINE│ 1hr ago   │ 1.0.0   │ [Edit] [On]  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Number Details Page (EXTENDED)                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Phase 1: Phone Info, Connected Accounts, Credentials      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ WhatsApp Session (NEW)                                     │  │
│  │ ┌─────────────────────────────────────────────────────┐   │  │
│  │ │ Status: ● LINKED                                     │   │  │
│  │ │ Session Code: HR-WA-0001                            │   │  │
│  │ │ Device: PC-01 (Main Office Desktop)                 │   │  │
│  │ │ Linked: Sep 15, 2026 11:00 AM                      │   │  │
│  │ │ Last Opened: Sep 15, 2026 2:30 PM                  │   │  │
│  │ └─────────────────────────────────────────────────────┘   │  │
│  │ [Open WhatsApp] [Reconnect] [Change Device] [Disable]     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Backend API Modules

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Server (/api/v1)                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Authentication Middleware                                    ││
│  │ - JWT validation                                            ││
│  │ - Role-based access control                                 ││
│  │ - Launcher API key validation                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │ Device Routes    │  │ WhatsApp Routes  │  │ Launcher Routes││
│  │                  │  │                  │  │                ││
│  │ GET    /devices  │  │ GET    /wa       │  │ POST /register ││
│  │ POST   /devices  │  │ POST   /wa       │  │ POST /heartbeat││
│  │ PATCH  /devices  │  │ PATCH  /wa       │  │ POST /launch   ││
│  │ DELETE /devices  │  │ DELETE /wa       │  │ POST /confirm  ││
│  │ POST   /hb       │  │ POST   /setup    │  │ POST /status   ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Service Layer                                               ││
│  │ - DeviceService: Device CRUD, heartbeat handling            ││
│  │ - WhatsAppService: Session lifecycle management             ││
│  │ - LauncherService: Launcher communication                   ││
│  │ - AuditService: Event logging                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Prisma ORM                                                  ││
│  │ - Type-safe database queries                                ││
│  │ - Automatic migrations                                      ││
│  │ - Connection pooling                                        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow Diagrams

### 4.1 Session Setup Flow

```
User (Dashboard)           API Server              Launcher              Chrome
       │                      │                      │                    │
       │  1. Click Setup      │                      │                    │
       │─────────────────────>│                      │                    │
       │                      │                      │                    │
       │                      │  2. Validate request │                    │
       │                      │  3. Create session   │                    │
       │                      │  4. Generate code    │                    │
       │                      │                      │                    │
       │                      │  5. POST /launch     │                    │
       │                      │─────────────────────>│                    │
       │                      │                      │                    │
       │                      │                      │  6. Validate URL   │
       │                      │                      │  7. Validate path  │
       │                      │                      │                    │
       │                      │                      │  8. Launch Chrome  │
       │                      │                      │───────────────────>│
       │                      │                      │                    │
       │                      │                      │  9. Return success │
       │                      │<─────────────────────│                    │
       │                      │                      │                    │
       │  10. Show QR prompt  │                      │                    │
       │<─────────────────────│                      │                    │
       │                      │                      │                    │
       │  11. User scans QR   │                      │                    │
       │                      │                      │                    │
       │                      │  12. POST /confirm   │                    │
       │                      │<─────────────────────│                    │
       │                      │                      │                    │
       │  13. Update status   │                      │                    │
       │  to LINKED           │                      │                    │
       │<─────────────────────│                      │                    │
```

### 4.2 Heartbeat Flow

```
Launcher                    API Server              Database
   │                           │                       │
   │  1. Every 60 seconds      │                       │
   │  POST /heartbeat          │                       │
   │──────────────────────────>│                       │
   │                           │                       │
   │                           │  2. Validate key      │
   │                           │  3. Update device     │
   │                           │──────────────────────>│
   │                           │                       │
   │                           │  4. Return status     │
   │<──────────────────────────│                       │
   │                           │                       │
   │  5. Update last_seen_at   │                       │
   │  and status=ONLINE        │                       │
```

### 4.3 Session Status Update Flow

```
Chrome Extension            Launcher                    API Server
   (optional)                  │                           │
       │                       │                           │
       │  1. Detect status     │                           │
       │  change               │                           │
       │──────────────────────>│                           │
       │                       │                           │
       │                       │  2. POST /status-update   │
       │                       │──────────────────────────>│
       │                       │                           │
       │                       │                           │  3. Update session
       │                       │                           │  4. Log audit event
       │                       │                           │
       │                       │  5. Return success        │
       │                       │<──────────────────────────│
```

---

## 5. Integration Points with Phase 1

### 5.1 Database Integration

Phase 2 tables reference Phase 1 tables:

| Phase 2 Table | References | Relationship |
|---------------|------------|--------------|
| `registered_devices.created_by` | `app_users.id` | Device creator |
| `whatsapp_sessions.phone_number_id` | `phone_numbers.id` | One WA session per phone |
| `whatsapp_sessions.device_id` | `registered_devices.id` | Session assigned to device |
| `whatsapp_sessions.created_by` | `app_users.id` | Session creator |
| `whatsapp_audit_logs.whatsapp_session_id` | `whatsapp_sessions.id` | Audit trail |
| `whatsapp_audit_logs.device_id` | `registered_devices.id` | Device context |
| `whatsapp_audit_logs.actor_user_id` | `app_users.id` | User who performed action |

### 5.2 API Integration

Phase 2 extends existing API structure:

```
/api/v1
├── /auth (Phase 1)
├── /users (Phase 1)
├── /phone-numbers (Phase 1)
│   └── /:id/whatsapp (Phase 2) ← NEW
├── /platforms (Phase 1)
├── /accounts (Phase 1)
├── /devices (Phase 2) ← NEW
└── /launcher (Phase 2) ← NEW
```

### 5.3 Frontend Integration

Phase 2 adds to existing pages:

1. **Dashboard Page**: WhatsApp stats card
2. **Number Details Page**: WhatsApp session section
3. **Add Number Flow**: WhatsApp toggle and device selection
4. **New Devices Page**: Device management interface

---

## 6. Multi-PC Architecture

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Central Dashboard Server                       │
│                    (Supabase + API)                               │
└─────────────────────────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   PC-01     │     │   PC-02     │     │   PC-03     │
   │   (Office)  │     │   (Home)    │     │   (Remote)  │
   │             │     │             │     │             │
   │ ┌─────────┐ │     │ ┌─────────┐ │     │ ┌─────────┐ │
   │ │Launcher │ │     │ │Launcher │ │     │ │Launcher │ │
   │ │ v1.0.0  │ │     │ │ v1.0.0  │ │     │ │ v1.0.0  │ │
   │ └─────────┘ │     │ └─────────┘ │     │ └─────────┘ │
   │             │     │             │     │             │
   │ ┌─────────┐ │     │ ┌─────────┐ │     │ ┌─────────┐ │
   │ │ Sessions│ │     │ │ Sessions│ │     │ │ Sessions│ │
   │ │ WA-0001 │ │     │ │ WA-0005 │ │     │ │ WA-0010 │ │
   │ │ WA-0002 │ │     │ │ WA-0006 │ │     │ │ WA-0011 │ │
   │ │ WA-0003 │ │     │ │ WA-0007 │ │     │ │ WA-0012 │ │
   │ │ WA-0004 │ │     │ │ WA-0008 │ │     │ │         │ │
   │ │         │ │     │ │ WA-0009 │ │     │ │         │ │
   │ └─────────┘ │     │ └─────────┘ │     │ └─────────┘ │
   └─────────────┘     └─────────────┘     └─────────────┘
```

### 6.2 Session Distribution Strategy

| Strategy | Description | Use Case |
|----------|-------------|----------|
| Geographic | Sessions assigned to nearest PC | Minimize latency |
| Load-based | Sessions distributed evenly | Balance resource usage |
| Dedicated | Specific sessions on specific PCs | Compliance or reliability |
| Manual | Admin assigns sessions | Full control |

### 6.3 Moving Sessions Between PCs

When a session moves from PC-01 to PC-02:

1. **Old PC (PC-01)**:
   - Session directory remains (not deleted automatically)
   - Chrome process may still be running
   - Manual cleanup may be needed

2. **Dashboard**:
   - Updates `whatsapp_sessions.device_id` to PC-02
   - Sets `status` to `SETUP_REQUIRED`
   - Logs `WA_SESSION_DEVICE_CHANGED` audit event
   - Preserves `session_code` (HR-WA-XXXX stays same)

3. **New PC (PC-02)**:
   - Creates new session directory: `C:\HairRap\WhatsAppSessions\HR-WA-XXXX\`
   - Launches Chrome with new profile
   - User must scan QR code again

### 6.4 Offline Handling

| Scenario | Behavior |
|----------|----------|
| Launcher offline | Status set to OFFLINE after 2 missed heartbeats (2 min) |
| Session on offline PC | Session status remains as-is, cannot be launched |
| Dashboard offline | Launcher queues commands, retries on reconnect |

---

## 7. Security Architecture

### 7.1 Authentication Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Layers                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Dashboard Users (JWT)                                  │
│  ├── Admin: Full access                                         │
│  ├── Editor: Create/update sessions                             │
│  └── Viewer: Read-only access                                   │
│                                                                  │
│  Layer 2: Launcher (API Key)                                     │
│  ├── Per-device API key                                         │
│  ├── Hashed in database                                         │
│  └── Shown once at registration                                 │
│                                                                  │
│  Layer 3: Service Role (Supabase)                                │
│  ├── Backend API uses service role                              │
│  └── Bypasses RLS for internal operations                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Launcher Security Validation

```python
# Allow-listed operations
ALLOWED_URLS = ["https://web.whatsapp.com"]
SESSION_DIR_PREFIX = "C:\\HairRap\\WhatsAppSessions\\"
SESSION_CODE_PATTERN = r"^HR-WA-\d{4,}$"
ALLOWED_BROWSERS = ["chrome.exe", "msedge.exe"]

# Validation checks
def validate_launch_request(request):
    assert request.target_url in ALLOWED_URLS
    assert request.session_dir.startswith(SESSION_DIR_PREFIX)
    assert re.match(SESSION_CODE_PATTERN, request.session_code)
    assert request.browser in ALLOWED_BROWSERS
    assert request.device_id == MY_DEVICE_ID
```

### 7.3 Data Flow Security

```
User → HTTPS → Dashboard → HTTPS → API Server → TLS → Database
                                    ↓
                              API Key Auth
                                    ↓
                              Launcher → Chrome (localhost)
```

---

## 8. Scalability Considerations

### 8.1 Current Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Sessions per PC | 20-50 | Chrome memory usage |
| Total sessions | 500+ | Database capacity |
| Heartbeat interval | 60s | Network overhead |
| API requests | 100/min | Rate limiting |

### 8.2 Scaling Strategies

1. **Horizontal**: Add more PCs with launchers
2. **Vertical**: Increase sessions per PC (more RAM)
3. **Database**: Connection pooling, read replicas
4. **Caching**: Redis for session status

---

## 9. Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Frontend | Next.js | 14.x | React framework |
| UI Components | Tailwind CSS | 3.x | Styling |
| State Management | React Query | 5.x | Server state |
| Backend | Express.js | 4.x | API server |
| ORM | Prisma | 5.x | Database access |
| Database | PostgreSQL | 15.x | Persistent storage |
| Launcher | Python | 3.11+ | Windows application |
| Browser | Chrome/Edge | Latest | WhatsApp Web |

---

## 10. Deployment Architecture

### 10.1 Development

```
Local Machine
├── Next.js dev server (port 3000)
├── Express API server (port 4000)
├── PostgreSQL (Docker or local)
└── Launcher (local Python)
```

### 10.2 Production

```
Supabase
├── PostgreSQL (managed)
├── Auth (managed)
└── Storage (if needed)

Vercel/Custom Server
├── Next.js (static + SSR)
└── Express API (serverless or container)

Windows PCs
└── Launcher (installed)
```

---

## 11. Monitoring & Observability

### 11.1 Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Device online count | Number of online devices | < 50% expected |
| Session success rate | Successful link operations | < 90% |
| Heartbeat latency | Time to process heartbeat | > 5s |
| API error rate | 4xx/5xx responses | > 5% |

### 11.2 Logging

- **Audit Logs**: All state changes logged
- **WhatsApp Audit Logs**: Session-specific events
- **Application Logs**: API server logs
- **Launcher Logs**: Local file logs

---

## 12. Future Considerations

### 12.1 Potential Enhancements

1. **Auto-reconnect**: Detect session expiry, auto-trigger reconnection
2. **Message monitoring**: Read message counts (privacy considerations)
3. **Multi-browser support**: Firefox, Brave
4. **Cloud launcher**: Run launcher in cloud VMs
5. **Mobile app**: Manage sessions from phone

### 12.2 Technical Debt

1. **Session cleanup**: Auto-archive old sessions
2. **Launcher updates**: Auto-update mechanism
3. **Error recovery**: More robust error handling
4. **Testing**: Automated E2E tests

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Session | WhatsApp Web browser instance with isolated profile |
| Launcher | Windows application that manages Chrome sessions |
| Device Code | Human-readable identifier (PC-01, PC-02) |
| Session Code | Auto-generated identifier (HR-WA-0001) |
| QR Linking | Process of scanning QR code to authenticate WhatsApp |

---

## Appendix B: References

- [Phase 2 Contract](../phase2_contract.md)
- [Database Design](./PHASE_2_DATABASE_DESIGN.md)
- [Launcher Specification](./PHASE_2_LAUNCHER_SPEC.md)
- [Security Review](./PHASE_2_SECURITY_REVIEW.md)
