# Phase 2 Setup and Onboarding Guide — Hair Rap by YOYO
## Step-by-Step Walkthrough

**Version:** 1.0  
**Date:** September 15, 2026  
**Status:** Production Ready

---

## 1. Overview

This guide walks you through setting up Phase 2 (WhatsApp Session Management) for Hair Rap by YOYO. By the end, you'll have:

- Registered devices (PCs) in the system
- WhatsApp sessions linked to phone numbers
- Launcher applications running on each PC

---

## 2. Prerequisites

### 2.1 Required Before Starting

| Requirement | Status | Notes |
|-------------|--------|-------|
| Phase 1 deployed | ✅ | Dashboard and API server running |
| Database migrated | ✅ | Phase 2 tables created |
| Admin account | ✅ | You need ADMIN role |
| Windows PC(s) | ✅ | For running launcher |
| Chrome/Edge | ✅ | Latest version |
| Phone numbers | ✅ | Already added to system |

### 2.2 Checklist

- [ ] Dashboard accessible at `https://your-dashboard.com`
- [ ] Logged in as ADMIN user
- [ ] Phase 2 database migration completed
- [ ] At least one phone number added to system
- [ ] Windows PC(s) available for launcher

---

## 3. How to Add a Real Number

### 3.1 Step 1: Navigate to Phone Numbers

1. Open the Hair Rap Dashboard
2. Click "Phone Numbers" in the sidebar
3. Click "Add Number" button

### 3.2 Step 2: Enter Phone Details

Fill in the phone number information:

| Field | Example | Notes |
|-------|---------|-------|
| Phone Number | +1234567890 | E.164 format |
| Country Code | +1 | Auto-detected |
| National Number | 234567890 | Auto-extracted |
| SIM Provider | Verizon | Optional |
| Label | Main Office Phone | Optional |
| Notes | Primary business line | Optional |

### 3.3 Step 3: Enable WhatsApp (Optional)

If you want to set up WhatsApp for this number:

1. Toggle "Enable WhatsApp" to ON
2. Select a device from the dropdown (if devices are registered)
3. Click "Save"

**If no devices are registered yet:**
- Save the phone number without WhatsApp
- Register a device first (see Section 4)
- Then add WhatsApp session later

### 3.4 Step 4: Verify Phone Number

After saving, verify the phone number appears in the list:

- Status should be "ACTIVE"
- E.164 number displayed correctly
- WhatsApp section shows (if enabled)

---

## 4. Device Registration Guide

### 4.1 Step 1: Navigate to Devices Page

1. Open the Hair Rap Dashboard
2. Click "Devices" in the sidebar
3. Click "Register Device" button

### 4.2 Step 2: Enter Device Information

| Field | Example | Notes |
|-------|---------|-------|
| Device Code | PC-01 | Must be unique (PC-XX format) |
| Friendly Name | Main Office Desktop | Descriptive name |
| Hostname | DESKTOP-ABC123 | Optional, auto-detected |

### 4.3 Step 3: Generate API Key

1. Click "Generate API Key"
2. **IMPORTANT**: Copy the API key immediately!
3. Store it securely (you won't see it again)

**Example API key:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 4.4 Step 4: Save Device

1. Click "Save Device"
2. Device appears in the list with status "UNKNOWN"
3. Status will change to "ONLINE" after launcher connects

### 4.5 Step 5: Install Launcher on PC

See [Launcher Specification](./PHASE_2_LAUNCHER_SPEC.md) for detailed installation instructions.

**Quick steps:**

1. Download launcher files to `C:\HairRap\`
2. Edit `config.toml`:
   ```toml
   [launcher]
   device_code = "PC-01"
   friendly_name = "Main Office Desktop"
   dashboard_url = "https://your-dashboard.com"
   api_key = "your-api-key-here"
   ```
3. Run `python launcher.py --test`
4. Run `python launcher.py` (or install as service)

### 4.6 Step 6: Verify Device Connection

After launcher starts:

1. Check launcher console for "Heartbeat sent successfully"
2. Refresh Devices page in dashboard
3. Device status should now be "ONLINE"
4. "Last Seen" should show recent timestamp

---

## 5. WhatsApp Session Setup Guide

### 5.1 Method 1: Setup During Phone Number Creation

If you enabled WhatsApp when adding the phone number:

1. Go to Phone Numbers → Select the number
2. Scroll to "WhatsApp Session" section
3. Click "Setup WhatsApp"
4. Dashboard sends command to launcher
5. Launcher opens Chrome with WhatsApp Web
6. Scan QR code with phone
7. Session status changes to "LINKED"

### 5.2 Method 2: Setup After Phone Number Creation

If you need to add WhatsApp to an existing phone number:

1. Go to Phone Numbers → Select the number
2. Scroll to "WhatsApp Session" section
3. Click "Add WhatsApp Session"
4. Select device from dropdown
5. Click "Create Session"
6. Click "Setup WhatsApp"
7. Scan QR code with phone
8. Session status changes to "LINKED"

### 5.3 Step-by-Step QR Linking Process

#### Step 1: Initiate Setup

1. Click "Setup WhatsApp" button
2. Dashboard status changes to "LINKING"
3. Dashboard sends launch command to launcher

#### Step 2: Launcher Opens Chrome

1. Launcher receives command
2. Launcher validates request
3. Launcher creates session directory: `C:\HairRap\WhatsAppSessions\HR-WA-XXXX\`
4. Launcher opens Chrome with `--user-data-dir=...`
5. Chrome opens `https://web.whatsapp.com`

#### Step 3: Scan QR Code

1. WhatsApp Web shows QR code
2. Open WhatsApp on your phone
3. Go to Settings → Linked Devices → Link a Device
4. Scan the QR code
5. Wait for authentication

#### Step 4: Confirmation

1. Launcher detects successful link
2. Launcher reports success to dashboard
3. Dashboard updates session status to "LINKED"
4. Dashboard records `linked_at` timestamp

### 5.4 Troubleshooting QR Linking

| Issue | Cause | Solution |
|-------|-------|----------|
| QR code not showing | Chrome not opening | Check launcher logs |
| QR code expired | Timeout | Click "Retry Setup" |
| Link failed | Network issue | Check internet connection |
| Session already linked | Previous session | Use "Reconnect" instead |

---

## 6. Managing WhatsApp Sessions

### 6.1 Viewing Session Status

Go to Phone Numbers → Select number → WhatsApp section:

| Status | Meaning | Available Actions |
|--------|---------|-------------------|
| SETUP_REQUIRED | New session, needs QR scan | [Setup WhatsApp] |
| LINKING | Waiting for QR scan | [Waiting...] (disabled) |
| LINKED | Active and working | [Open] [Reconnect] [Change Device] [Disable] |
| RELOGIN_REQUIRED | Session expired | [Reconnect] |
| DISABLED | Manually disabled | [Enable] [Change Device] |
| ERROR | Error occurred | [Retry Setup] [Change Device] |

### 6.2 Opening an Existing Session

For LINKED sessions:

1. Click "Open WhatsApp"
2. Dashboard sends open command to launcher
3. Launcher opens Chrome with existing session data
4. WhatsApp Web opens already authenticated

### 6.3 Reconnecting a Session

For RELOGIN_REQUIRED or ERROR sessions:

1. Click "Reconnect"
2. Dashboard resets status to "LINKING"
3. Launcher opens Chrome
4. Scan QR code again
5. Session returns to "LINKED"

### 6.4 Disabling a Session

To temporarily disable a session:

1. Click "Disable"
2. Confirm the action
3. Session status changes to "DISABLED"
4. Session can be re-enabled later

### 6.5 Enabling a Session

To re-enable a disabled session:

1. Click "Enable"
2. Session status changes to "SETUP_REQUIRED"
3. Follow setup process again

---

## 7. Moving Numbers Between PCs

### 7.1 When to Move

Move a WhatsApp session when:
- PC is being replaced
- PC is being decommissioned
- Load balancing across PCs
- Geographic optimization

### 7.2 Step-by-Step Move Process

#### Step 1: Identify Current Assignment

1. Go to Phone Numbers → Select number
2. Note current device (e.g., PC-01)
3. Note current session code (e.g., HR-WA-0001)

#### Step 2: Change Device Assignment

1. Click "Change Device"
2. Select new device (e.g., PC-02)
3. Confirm the change

#### Step 3: What Happens

1. **On Dashboard:**
   - `device_id` updated to PC-02
   - `status` reset to "SETUP_REQUIRED"
   - `session_code` preserved (HR-WA-0001)
   - Audit log records device change

2. **On Old PC (PC-01):**
   - Session directory remains (not deleted)
   - Chrome may still be running
   - Manual cleanup may be needed

3. **On New PC (PC-02):**
   - New session directory created: `C:\HairRap\WhatsAppSessions\HR-WA-0001\`
   - Ready for QR scan

#### Step 4: Re-link on New PC

1. Click "Setup WhatsApp"
2. Launcher on PC-02 opens Chrome
3. Scan QR code with phone
4. Session linked on new PC

### 7.3 Important Notes

- **Session code preserved**: HR-WA-XXXX stays the same
- **Old session not deleted**: Cleanup is manual
- **Re-scan required**: Must scan QR on new PC
- **Audit trail**: All changes logged

---

## 8. Managing Devices

### 8.1 Viewing Devices

Go to Devices page to see all registered devices:

| Column | Description |
|--------|-------------|
| Code | Device code (PC-01) |
| Name | Friendly name |
| Status | ONLINE/OFFLINE/UNKNOWN/DISABLED |
| Last Seen | Last heartbeat timestamp |
| Version | Launcher version |
| Actions | Edit/Enable/Disable |

### 8.2 Editing Device Information

1. Click Edit button on device row
2. Update friendly name or hostname
3. Click Save

### 8.3 Disabling a Device

To temporarily disable a device:

1. Click Disable button
2. Confirm the action
3. Device status changes to "DISABLED"
4. Cannot launch new sessions on this device
5. Existing sessions remain but cannot be opened

### 8.4 Enabling a Device

To re-enable a disabled device:

1. Click Enable button
2. Device status changes to "UNKNOWN"
3. Will change to "ONLINE" after next heartbeat

### 8.5 Viewing Device Sessions

1. Click on device row
2. View all sessions assigned to this device
3. See session status and last activity

---

## 9. Best Practices

### 9.1 Device Management

| Practice | Recommendation |
|----------|----------------|
| Naming | Use descriptive names (Office-PC-01) |
| Codes | Use sequential codes (PC-01, PC-02) |
| Monitoring | Check device status daily |
| Updates | Keep launcher updated |

### 9.2 Session Management

| Practice | Recommendation |
|----------|----------------|
| Distribution | Spread sessions across devices |
| Monitoring | Check session status regularly |
| Cleanup | Disable unused sessions |
| Backup | Note session codes for recovery |

### 9.3 Security

| Practice | Recommendation |
|----------|----------------|
| API Keys | Store securely, don't share |
| Access | Limit ADMIN role to trusted users |
| Monitoring | Review audit logs regularly |
| Updates | Keep launcher and Chrome updated |

---

## 10. Common Scenarios

### 10.1 Scenario: New Office Setup

**Goal:** Set up Hair Rap at a new office location

**Steps:**
1. Install Chrome on office PC
2. Download and install launcher
3. Register device in dashboard (e.g., PC-03)
4. Configure launcher with API key
5. Start launcher
6. Add phone numbers (or move existing ones)
7. Set up WhatsApp sessions
8. Verify all sessions are LINKED

### 10.2 Scenario: PC Replacement

**Goal:** Replace old PC with new PC

**Steps:**
1. Note all sessions on old PC
2. Register new PC in dashboard (e.g., PC-04)
3. Install launcher on new PC
4. Move sessions from old PC to new PC
5. Re-link all sessions on new PC
6. Disable old PC in dashboard
7. Verify all sessions work on new PC

### 10.3 Scenario: Session Recovery

**Goal:** Recover from session error

**Steps:**
1. Identify error session
2. Check error message in dashboard
3. If RELOGIN_REQUIRED: Click "Reconnect"
4. If ERROR: Click "Retry Setup"
5. Scan QR code
6. Verify session status is LINKED

### 10.4 Scenario: Load Balancing

**Goal:** Distribute sessions evenly across PCs

**Steps:**
1. Check current session distribution
2. Identify overloaded PCs
3. Move sessions to underutilized PCs
4. Verify all sessions work after move
5. Monitor distribution over time

---

## 11. FAQ

### Q: Can I use the same phone number on multiple devices?

**A:** No. Each phone number can have only one WhatsApp session, assigned to one device. To move it, use "Change Device" feature.

### Q: What happens if a PC goes offline?

**A:** Sessions on that PC cannot be launched. The PC status shows OFFLINE after 2 missed heartbeats. Sessions remain assigned but inactive.

### Q: Do I need to re-scan QR code after moving a session?

**A:** Yes. Each device has its own Chrome profile. Moving a session requires re-authentication on the new device.

### Q: Can I run multiple sessions on one PC?

**A:** Yes. Each session has its own Chrome profile directory. A PC can host 20-50 sessions depending on available RAM.

### Q: What if Chrome is not installed?

**A:** The launcher will report an error. Install Chrome or Edge, then retry the setup.

### Q: How do I update the launcher?

**A:** Stop the launcher, replace launcher.py with new version, update dependencies if needed, and restart.

---

## 12. Quick Reference

### 12.1 Key URLs

| URL | Purpose |
|-----|---------|
| `https://your-dashboard.com/phones` | Phone numbers list |
| `https://your-dashboard.com/devices` | Devices list |
| `https://your-dashboard.com/phones/:id` | Phone details (WhatsApp section) |

### 12.2 Key Commands

| Command | Purpose |
|---------|---------|
| `python launcher.py --test` | Test launcher connection |
| `python launcher.py` | Start launcher |
| `net start HairRapLauncher` | Start launcher service |
| `net stop HairRapLauncher` | Stop launcher service |

### 12.3 Key Files

| File | Location | Purpose |
|------|----------|---------|
| `config.toml` | `C:\HairRap\` | Launcher configuration |
| `launcher.log` | `C:\HairRap\` | Launcher logs |
| Session data | `C:\HairRap\WhatsAppSessions\HR-WA-XXXX\` | Chrome profiles |

---

## 13. Support

### 13.1 Getting Help

1. Check this guide first
2. Review launcher logs: `C:\HairRap\launcher.log`
3. Check dashboard audit logs
4. Contact Hair Rap support team

### 13.2 Reporting Issues

When reporting issues, include:
- Device code (PC-XX)
- Session code (HR-WA-XXXX)
- Error message (if any)
- Launcher log excerpt
- Steps to reproduce

---

## Appendix A: Checklist Templates

### New Device Setup Checklist

- [ ] Chrome/Edge installed on PC
- [ ] Python 3.11+ installed
- [ ] Launcher files downloaded to `C:\HairRap\`
- [ ] Device registered in dashboard
- [ ] API key copied and stored securely
- [ ] `config.toml` configured
- [ ] `C:\HairRap\WhatsAppSessions\` directory created
- [ ] Launcher tested with `--test` flag
- [ ] Launcher started (foreground or service)
- [ ] Device shows ONLINE in dashboard

### New WhatsApp Session Checklist

- [ ] Phone number added to system
- [ ] Device registered and ONLINE
- [ ] WhatsApp session created
- [ ] "Setup WhatsApp" clicked
- [ ] Chrome opened on device
- [ ] QR code scanned with phone
- [ ] Session status shows LINKED
- [ ] Test "Open WhatsApp" works

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Device | PC running the Hair Rap launcher |
| Device Code | Unique identifier for device (PC-01) |
| Session | WhatsApp Web browser instance |
| Session Code | Unique identifier for session (HR-WA-0001) |
| Launcher | Windows application managing sessions |
| QR Linking | Process of authenticating WhatsApp Web |
| E.164 | International phone number format (+1234567890) |

---

## References

- [Launcher Specification](./PHASE_2_LAUNCHER_SPEC.md)
- [Architecture Document](./PHASE_2_ARCHITECTURE.md)
- [Database Design](./PHASE_2_DATABASE_DESIGN.md)
- [Security Review](./PHASE_2_SECURITY_REVIEW.md)
