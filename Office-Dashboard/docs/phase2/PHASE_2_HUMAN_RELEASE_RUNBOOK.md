# Phase 2 Human Release Runbook — Hair Rap by YOYO
## Deployment and Release Procedures

**Version:** 1.0  
**Date:** September 15, 2026  
**Status:** Production Ready

---

## 1. Pre-release Checklist

### 1.1 Code Readiness

- [ ] All Phase 2 code merged to main branch
- [ ] Code review completed and approved
- [ ] All tests passing (98%+ pass rate)
- [ ] No critical or high-severity bugs open
- [ ] Security review completed
- [ ] Performance benchmarks met

### 1.2 Documentation Readiness

- [ ] All documentation complete
- [ ] API documentation updated
- [ ] User guides finalized
- [ ] Release notes prepared
- [ ] Training materials ready

### 1.3 Environment Readiness

- [ ] Production database backed up
- [ ] Staging environment tested
- [ ] Monitoring configured
- [ ] Alerting configured
- [ ] Rollback plan documented

### 1.4 Team Readiness

- [ ] Development team on standby
- [ ] QA team available for verification
- [ ] DevOps team ready for deployment
- [ ] Support team briefed
- [ ] stakeholders notified

---

## 2. Database Migration Steps

### 2.1 Backup Current Database

```bash
# Connect to Supabase/PostgreSQL
psql -h your-host -U your-user -d your-database

# Create backup
pg_dump -h your-host -U your-user -d your-database > backup_pre_phase2_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_pre_phase2_*.sql
```

### 2.2 Run Phase 2 Migration

```bash
# Connect to production database
psql -h your-host -U your-user -d your-database

# Run migration script
\i /path/to/database/PHASE2_MIGRATION.sql

# Expected output:
# NOTICE:  ✅ Phase 1 prerequisites verified
# NOTICE:  Created enum: device_status
# NOTICE:  Created enum: whatsapp_session_status
# NOTICE:  Created table: registered_devices
# NOTICE:  Created table: whatsapp_sessions
# NOTICE:  Created table: whatsapp_audit_logs
# NOTICE:  Created Phase 2 indexes
# NOTICE:  Added table comments
# NOTICE:  Granted permissions
# NOTICE:  ========================================
# NOTICE:  Phase 2 Migration Complete!
# NOTICE:  ========================================
# NOTICE:  Tables created: 3 (expected: 3)
# NOTICE:  Enums created: 2 (expected: 2)
# NOTICE:  Indexes created: 2 (expected: 2)
# NOTICE:  ✅ Phase 2 migration successful!
```

### 2.3 Verify Migration

```bash
# Run verification script
\i /path/to/database/SUPABASE_VERIFY.sql

# Check for:
# - All 11 tables present
# - All 8 enums present
# - All indexes created
# - All foreign keys valid
# - Platform seeds present
# - Admin user exists
```

### 2.4 Migration Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Phase 1 tables not found" | Migration run on wrong database | Verify database connection |
| "Extension not found" | uuid-ossp not enabled | Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` |
| "Permission denied" | Insufficient privileges | Use superuser or grant permissions |
| "Table already exists" | Migration run twice | Skip or drop and re-run |

---

## 3. Deployment Steps

### 3.1 Backend Deployment

#### Step 1: Prepare Release

```bash
# Checkout main branch
git checkout main
git pull origin main

# Verify latest code
git log --oneline -5

# Create release tag
git tag -a v2.0.0 -m "Phase 2 - WhatsApp Session Management"
git push origin v2.0.0
```

#### Step 2: Build Backend

```bash
# Navigate to backend directory
cd hair-rap-dashboard

# Install dependencies
npm install

# Build application
npm run build

# Verify build
ls -la dist/
```

#### Step 3: Deploy to Production

```bash
# Option A: Deploy to Vercel/Netlify
vercel deploy --prod

# Option B: Deploy to custom server
rsync -avz dist/ user@server:/path/to/app/
ssh user@server "cd /path/to/app && npm install --production && pm2 restart app"

# Option C: Deploy with Docker
docker build -t hair-rap-backend:v2.0.0 .
docker push registry.hairrap.com/backend:v2.0.0
ssh user@server "docker pull registry.hairrap.com/backend:v2.0.0 && docker-compose up -d"
```

#### Step 4: Verify Backend

```bash
# Health check
curl https://api.hairrap.com/health

# Expected response:
# {"status":"ok","version":"2.0.0"}

# Test API endpoint
curl -H "Authorization: Bearer <token>" https://api.hairrap.com/api/v1/devices

# Expected response:
# {"data":[],"meta":{"total":0}}
```

### 3.2 Frontend Deployment

#### Step 1: Build Frontend

```bash
# Navigate to frontend directory
cd hair-rap-dashboard/frontend

# Install dependencies
npm install

# Build application
npm run build

# Verify build
ls -la .next/
```

#### Step 2: Deploy Frontend

```bash
# Option A: Deploy to Vercel
vercel deploy --prod

# Option B: Deploy to custom server
rsync -avz .next/ user@server:/path/to/frontend/
ssh user@server "cd /path/to/frontend && pm2 restart frontend"

# Option C: Deploy with Docker
docker build -t hair-rap-frontend:v2.0.0 .
docker push registry.hairrap.com/frontend:v2.0.0
ssh user@server "docker pull registry.hairrap.com/frontend:v2.0.0 && docker-compose up -d"
```

#### Step 3: Verify Frontend

```bash
# Open browser
open https://dashboard.hairrap.com

# Verify:
# - Login page loads
# - Can login successfully
# - Dashboard displays
# - Devices page accessible
# - Phone numbers page accessible
```

### 3.3 Launcher Distribution

#### Step 1: Prepare Launcher Package

```bash
# Create launcher package
mkdir -p release/launcher
cp main.py release/launcher/
cp launcher_config.json release/launcher/
cp requirements.txt release/launcher/
cp install.bat release/launcher/
cp README.md release/launcher/

# Create ZIP archive
cd release
zip -r hair-rap-launcher-v2.0.0.zip launcher/
```

#### Step 2: Distribute Launcher

1. Upload launcher ZIP to secure file share
2. Send download link to PC operators
3. Provide setup instructions
4. Schedule setup sessions if needed

#### Step 3: Verify Launcher Installation

For each PC:

```powershell
# Navigate to launcher directory
cd C:\HairRap

# Test connection
python main.py --test

# Expected output:
# [INFO] Testing connection to dashboard...
# [INFO] Connection successful!
# [INFO] Device registered: PC-XX

# Start launcher
python main.py

# Verify in dashboard
# Device should show ONLINE status
```

---

## 4. Verification Steps

### 4.1 Smoke Tests

#### Test 1: Database Connectivity

```sql
-- Connect to production database
psql -h your-host -U your-user -d your-database

-- Verify tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('registered_devices', 'whatsapp_sessions', 'whatsapp_audit_logs');

-- Expected: 3 rows
```

#### Test 2: API Health

```bash
# Health check
curl https://api.hairrap.com/health

# Expected: {"status":"ok","version":"2.0.0"}
```

#### Test 3: Authentication

```bash
# Login
curl -X POST https://api.hairrap.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hairrap.com","password":"your-password"}'

# Expected: {"token":"eyJ...","user":{...}}
```

#### Test 4: Device Registration

```bash
# Register device
curl -X POST https://api.hairrap.com/api/v1/devices \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"deviceCode":"PC-TEST","friendlyName":"Test Device"}'

# Expected: {"id":"uuid","deviceCode":"PC-TEST",...}
```

#### Test 5: WhatsApp Session Creation

```bash
# Create WA session
curl -X POST https://api.hairrap.com/api/v1/phone-numbers/<phone-id>/whatsapp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<device-id>"}'

# Expected: {"id":"uuid","sessionCode":"HR-WA-XXXX","status":"SETUP_REQUIRED",...}
```

### 4.2 Functional Verification

| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Login | Enter credentials, click Login | Redirect to dashboard | - |
| View Devices | Click Devices in sidebar | Device list displayed | - |
| Register Device | Click Register, fill form, save | Device created | - |
| View Phone | Click Phone Numbers, select number | Phone details displayed | - |
| Create WA Session | Click Add WhatsApp, select device | Session created | - |
| Setup WhatsApp | Click Setup WhatsApp | Chrome opens, QR shown | - |
| Link Session | Scan QR code | Status changes to LINKED | - |
| Open Session | Click Open WhatsApp | Chrome opens with session | - |

### 4.3 Performance Verification

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| API Response Time | < 200ms | - | - |
| Page Load Time | < 2s | - | - |
| Database Query Time | < 100ms | - | - |
| Launcher Heartbeat | < 1s | - | - |

### 4.4 Security Verification

| Check | Expected | Status |
|-------|----------|--------|
| HTTPS enforced | HTTP redirects to HTTPS | - |
| Authentication required | 401 without token | - |
| Authorization enforced | 403 for wrong role | - |
| Input validation | Invalid input rejected | - |
| Audit logging | Actions logged | - |

---

## 5. Rollback Procedure

### 5.1 When to Rollback

Rollback if:
- Critical bugs affecting core functionality
- Security vulnerabilities discovered
- Data corruption detected
- Performance degradation > 50%
- More than 10% of users affected

### 5.2 Database Rollback

```bash
# Connect to production database
psql -h your-host -U your-user -d your-database

# Run rollback script
\i /path/to/database/SUPABASE_ROLLBACK.sql

# Expected output:
# NOTICE:  ========================================
# NOTICE:  WARNING: Phase 2 Rollback Script
# NOTICE:  This will DROP all Phase 2 tables!
# NOTICE:  ========================================
# NOTICE:  Tables to be dropped:
# NOTICE:    - whatsapp_audit_logs
# NOTICE:    - whatsapp_sessions
# NOTICE:    - registered_devices
# NOTICE:  
# NOTICE:  Enums to be dropped:
# NOTICE:    - whatsapp_session_status
# NOTICE:    - device_status
# NOTICE:  
# NOTICE:  Press Ctrl+C within 5 seconds to cancel...
# NOTICE:  ✅ Phase 2 rollback completed successfully
# NOTICE:  Phase 1 tables remain intact.

# Verify rollback
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('registered_devices', 'whatsapp_sessions', 'whatsapp_audit_logs');

# Expected: 0 rows
```

### 5.3 Application Rollback

```bash
# Revert to previous version
git checkout v1.x.x

# Rebuild backend
cd hair-rap-dashboard
npm install
npm run build

# Redeploy
vercel deploy --prod
# or
rsync -avz dist/ user@server:/path/to/app/
ssh user@server "cd /path/to/app && npm install --production && pm2 restart app"

# Verify
curl https://api.hairrap.com/health
```

### 5.4 Frontend Rollback

```bash
# Revert to previous version
git checkout v1.x.x

# Rebuild frontend
cd hair-rap-dashboard/frontend
npm install
npm run build

# Redeploy
vercel deploy --prod

# Verify
open https://dashboard.hairrap.com
```

### 5.5 Launcher Rollback

```bash
# Stop launcher on all PCs
# (Manual process for each PC)

# Revert launcher files
# (Copy previous version to C:\HairRap\)

# Restart launcher
python main.py
```

### 5.6 Post-Rollback Verification

- [ ] Phase 1 features working
- [ ] No data loss
- [ ] No error spikes
- [ ] Users can login
- [ ] Phone numbers accessible
- [ ] Platform accounts accessible

---

## 6. Post-release Checklist

### 6.1 Immediate (First 24 hours)

- [ ] Monitor error rates
- [ ] Monitor API response times
- [ ] Monitor database performance
- [ ] Check launcher connections
- [ ] Review audit logs
- [ ] Respond to user reports

### 6.2 Short-term (First week)

- [ ] Review user feedback
- [ ] Monitor performance trends
- [ ] Check for memory leaks
- [ ] Verify backup procedures
- [ ] Document any issues
- [ ] Plan hotfixes if needed

### 6.3 Long-term (First month)

- [ ] Performance optimization
- [ ] User training sessions
- [ ] Documentation updates
- [ ] Feature usage analysis
- [ ] Plan next phase
- [ ] Retrospective meeting

---

## 7. Communication Plan

### 7.1 Pre-release Communication

| Audience | Channel | Timing | Message |
|----------|---------|--------|---------|
| Development Team | Slack | 1 week before | Release schedule |
| QA Team | Email | 3 days before | Test plan |
| Stakeholders | Email | 1 week before | Release overview |
| Users | In-app | 1 day before | Maintenance notice |

### 7.2 Release Day Communication

| Audience | Channel | Timing | Message |
|----------|---------|--------|---------|
| Development Team | Slack | During deployment | Status updates |
| QA Team | Slack | After deployment | Verification request |
| Stakeholders | Email | After deployment | Release confirmation |
| Users | In-app | After deployment | Feature announcement |

### 7.3 Post-release Communication

| Audience | Channel | Timing | Message |
|----------|---------|--------|---------|
| Development Team | Slack | Daily | Issue reports |
| Users | Email | 1 week after | Usage guide |
| Stakeholders | Email | 2 weeks after | Success metrics |

---

## 8. Monitoring and Alerting

### 8.1 Key Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| API Error Rate | > 5% | Slack + Email |
| API Response Time | > 500ms | Slack |
| Database Connections | > 80% | Slack + Email |
| Launcher Offline | > 10% | Slack |
| Failed Logins | > 10/hour | Email |

### 8.2 Monitoring Tools

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking |
| Datadog | Performance monitoring |
| Supabase Dashboard | Database monitoring |
| Custom Dashboard | Business metrics |

### 8.3 Alert Recipients

| Alert | Recipients |
|-------|------------|
| Critical | DevOps, Tech Lead, PM |
| High | DevOps, Tech Lead |
| Medium | DevOps |
| Low | Logged only |

---

## 9. Support Procedures

### 9.1 Support Channels

| Channel | Purpose | Response Time |
|---------|---------|---------------|
| Email | General inquiries | 24 hours |
| Slack | Urgent issues | 1 hour |
| Phone | Critical issues | Immediate |
| In-app | Feature requests | 48 hours |

### 9.2 Escalation Path

1. **Level 1**: Support team
2. **Level 2**: Development team
3. **Level 3**: Tech Lead
4. **Level 4**: Management

### 9.3 Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Cannot login | Reset password, check credentials |
| Device offline | Check launcher, restart if needed |
| Session not linking | Check Chrome, retry setup |
| QR code not showing | Check launcher logs, restart Chrome |
| Slow performance | Check database, optimize queries |

---

## 10. Rollback Decision Matrix

| Issue | Severity | Impact | Decision |
|-------|----------|--------|----------|
| Login broken | Critical | All users | Immediate rollback |
| API errors > 10% | Critical | All users | Immediate rollback |
| Data corruption | Critical | Data integrity | Immediate rollback |
| Security breach | Critical | Security | Immediate rollback |
| Device connection issues | High | Launcher users | Monitor, rollback if > 30% |
| Slow performance | Medium | User experience | Monitor, optimize |
| UI cosmetic issues | Low | Minor | Fix in next release |

---

## 11. Success Criteria

### 11.1 Deployment Success

- [ ] All smoke tests pass
- [ ] No critical errors
- [ ] Performance within thresholds
- [ ] Users can access features
- [ ] Launchers connecting

### 11.2 Release Success (1 week)

- [ ] Error rate < 1%
- [ ] 95% of devices online
- [ ] 80% of sessions linked
- [ ] No data loss
- [ ] Positive user feedback

### 11.3 Business Success (1 month)

- [ ] 50+ WhatsApp sessions active
- [ ] 5+ devices registered
- [ ] 90% user satisfaction
- [ ] Support tickets < 10/week
- [ ] Performance stable

---

## 12. Appendices

### A. Contact List

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Project Manager | | | |
| Tech Lead | | | |
| DevOps Lead | | | |
| QA Lead | | | |
| Database Admin | | | |
| Security Lead | | | |

### B. Environment Details

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | https://dashboard.hairrap.com | Live system |
| Staging | https://staging.hairrap.com | Pre-production testing |
| Development | http://localhost:3000 | Local development |

### C. Database Connection Strings

```
Production: postgresql://user:pass@host:5432/hairrap_prod
Staging: postgresql://user:pass@host:5432/hairrap_staging
Development: postgresql://user:pass@localhost:5432/hairrap_dev
```

### D. Deployment Scripts

**deploy.sh:**
```bash
#!/bin/bash
set -e

echo "Starting deployment..."

# Build
npm run build

# Test
npm test

# Deploy
vercel deploy --prod

# Verify
curl -f https://api.hairrap.com/health || exit 1

echo "Deployment complete!"
```

**rollback.sh:**
```bash
#!/bin/bash
set -e

echo "Starting rollback..."

# Revert code
git checkout v1.x.x

# Build
npm run build

# Deploy
vercel deploy --prod

# Verify
curl -f https://api.hairrap.com/health || exit 1

echo "Rollback complete!"
```

---

## References

- [Phase 2 Contract](../phase2_contract.md)
- [Architecture Document](./PHASE_2_ARCHITECTURE.md)
- [Database Design](./PHASE_2_DATABASE_DESIGN.md)
- [Launcher Specification](./PHASE_2_LAUNCHER_SPEC.md)
- [Security Review](./PHASE_2_SECURITY_REVIEW.md)
- [QA Certification](./PHASE_2_QA_CERTIFICATION.md)
- [Completion Report](./PHASE_2_FINAL_COMPLETION_REPORT.md)

