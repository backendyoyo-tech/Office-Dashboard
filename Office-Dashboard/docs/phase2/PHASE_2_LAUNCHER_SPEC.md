# Phase 2 Launcher Specification — Hair Rap by YOYO
## Windows Launcher Application

**Version:** 1.0  
**Date:** September 15, 2026  
**Status:** Production Ready

---

## 1. Launcher Architecture

### 1.1 Overview

The Hair Rap Launcher is a Windows application that runs on each PC managing WhatsApp Web sessions. It communicates with the central dashboard API to receive commands and report status.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Windows PC (e.g., PC-01)                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Hair Rap Launcher                          ││
│  │                  (Python 3.11+)                             ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         ││
│  │  │  Config     │  │  API Client │  │  Browser    │         ││
│  │  │  Manager    │  │  Module     │  │  Manager    │         ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘         ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         ││
│  │  │  Heartbeat  │  │  Command    │  │  Validator  │         ││
│  │  │  Service    │  │  Listener   │  │  Module     │         ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘         ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Chrome/Edge Browser                         ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         ││
│  │  │  Session    │  │  Session    │  │  Session    │         ││
│  │  │  HR-WA-0001 │  │  HR-WA-0002 │  │  HR-WA-0003 │         ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘         ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  C:\HairRap\WhatsAppSessions\                                   │
│  ├── HR-WA-0001\                                                │
│  │   └── (Chrome user data)                                    │
│  ├── HR-WA-0002\                                                │
│  │   └── (Chrome user data)                                    │
│  └── HR-WA-0003\                                                │
│      └── (Chrome user data)                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Description

| Component | Purpose |
|-----------|---------|
| **Config Manager** | Read/write launcher configuration file |
| **API Client** | Communicate with dashboard API |
| **Browser Manager** | Launch and manage Chrome/Edge instances |
| **Heartbeat Service** | Send periodic heartbeat to dashboard |
| **Command Listener** | Receive and process commands from dashboard |
| **Validator Module** | Validate all commands against security rules |

### 1.3 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Python | 3.11+ |
| HTTP Client | `requests` | 2.31+ |
| Process Management | `subprocess` | stdlib |
| Configuration | `toml` / `json` | stdlib |
| Scheduling | `schedule` | 1.2+ |
| Logging | `logging` | stdlib |
| Service | `pywin32` | 306+ (optional) |

---

## 2. Security Model

### 2.1 Authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                    Launcher Authentication                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Registration Flow:                                              │
│  1. Admin registers device in dashboard                         │
│  2. Dashboard generates API key (random 32-byte hex)            │
│  3. Dashboard stores hash of API key                            │
│  4. Dashboard shows raw API key to admin (once)                 │
│  5. Admin enters API key in launcher config                     │
│                                                                  │
│  Request Flow:                                                   │
│  1. Launcher includes API key in Authorization header           │
│  2. Dashboard hashes received key                               │
│  3. Dashboard compares hash with stored hash                    │
│  4. If match, request is authenticated                          │
│                                                                  │
│  Header Format:                                                  │
│  Authorization: Bearer <api-key>                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Authorization

Launcher can ONLY:
- Register itself with the dashboard
- Send heartbeat/status updates
- Confirm session link/unlink status
- Report errors

Launcher MUST NOT:
- Execute arbitrary commands
- Open arbitrary URLs
- Read WhatsApp messages/data
- Inject code into WhatsApp Web
- Automate QR scanning

### 2.3 API Key Security

| Aspect | Implementation |
|--------|----------------|
| Generation | Cryptographically random 32-byte hex |
| Storage (Dashboard) | Argon2id hash |
| Storage (Launcher) | Plain text in config file (protected by filesystem) |
| Transmission | HTTPS only |
| Rotation | Manual re-registration required |

---

## 3. Communication Protocol

### 3.1 Heartbeat

**Endpoint:** `POST /api/v1/launcher/heartbeat`  
**Interval:** Every 60 seconds  
**Authentication:** API Key

**Request:**
```json
{
  "deviceCode": "PC-01",
  "hostname": "DESKTOP-ABC123",
  "launcherVersion": "1.0.0",
  "activeSessions": ["HR-WA-0001", "HR-WA-0002"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "device": {
    "id": "uuid",
    "status": "ONLINE",
    "pendingCommands": []
  }
}
```

### 3.2 Session Launch (Command Polling)

**Endpoint:** `GET /api/v1/launcher/whatsapp-launch`  
**Direction:** Launcher → Dashboard  
**Authentication:** API Key (Bearer token)

**Description:** The launcher polls this endpoint on each heartbeat cycle to receive pending launch commands. The dashboard returns a list of sessions that need browser launching (status = `LINKING` or `SETUP_REQUIRED`).

**Request:**
```
GET /api/v1/launcher/whatsapp-launch
Authorization: Bearer hr_launcher_<api_key>
```

**Response (200 OK):**
```json
{
  "deviceId": "uuid",
  "deviceCode": "PC-01",
  "commands": [
    {
      "type": "launch-whatsapp",
      "data": {
        "session_id": "uuid",
        "session_code": "HR-WA-0001",
        "session_directory": "C:\\HairRap\\WhatsAppSessions\\HR-WA-0001",
        "target_url": "https://web.whatsapp.com",
        "phone_e164": "+14155550001",
        "action": "setup"
      }
    }
  ]
}
```

**Status mapping for `action`:**
- `SETUP_REQUIRED` → `"setup"` (first-time WhatsApp setup)
- `LINKING` → `"open"` (re-opening an existing linked session)

### 3.3 Browser Launch Confirmation

**Endpoint:** `POST /api/v1/launcher/whatsapp-confirm`  
**Direction:** Launcher → Dashboard  
**Authentication:** API Key

**Description:** The launcher reports whether the browser launched successfully. On success, the session stays in `LINKING` state (browser opened, QR not yet scanned). On failure, the session transitions to `ERROR`.

**Request:**
```json
{
  "session_id": "uuid",
  "success": true,
  "error": null
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "sessionCode": "HR-WA-0001",
  "status": "LINKING",
  "lastOpenedAt": "2026-09-15T11:00:00Z"
}
```

**On failure (`"success": false`):**
```json
{
  "id": "uuid",
  "sessionCode": "HR-WA-0001",
  "status": "ERROR",
  "lastError": "Failed to launch browser",
  "lastOpenedAt": "2026-09-15T11:00:00Z"
}
```

### 3.4 Status Update

**Endpoint:** `POST /api/v1/launcher/whatsapp-status`  
**Direction:** Launcher → Dashboard  
**Authentication:** API Key

**Description:** The launcher reports session status changes. Launcher status values are mapped to database enum values.

**Request:**
```json
{
  "session_id": "uuid",
  "status": "running",
  "error": null
}
```

**Status mapping (launcher → database enum):**

| Launcher Status | Database Status | Meaning |
|----------------|-----------------|---------|
| `launching` | `LINKING` | Browser is starting |
| `running` | `LINKING` | Browser is open, QR not yet scanned |
| `closed` | `RELOGIN_REQUIRED` | Browser was closed, needs re-link |
| `error` | `ERROR` | Browser or session error |
| `linked` | `LINKED` | Launcher detected successful QR scan |

---

## 4. Installation Guide

### 4.1 Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Windows | 10/11 | 64-bit |
| Python | 3.11+ | Add to PATH |
| Chrome/Edge | Latest | At least one required |
| Internet | Required | For API communication |

### 4.2 Installation Steps

#### Step 1: Download Launcher

```powershell
# Create directory
mkdir C:\HairRap
cd C:\HairRap

# Download launcher files
# (Files provided by Hair Rap team)
# - main.py
# - config.py
# - security.py
# - browser.py
# - server.py
# - api_client.py
# - requirements.txt
# - install.bat (optional)
```

#### Step 2: Install Dependencies

```powershell
cd C:\HairRap
pip install -r requirements.txt
```

**requirements.txt:**
```
requests>=2.31.0
schedule>=1.2.0
pywin32>=306; sys_platform == 'win32'
```

#### Step 3: Configure Launcher

Edit `launcher_config.json`:

```toml
[launcher]
device_code = "PC-01"
friendly_name = "Main Office Desktop"
dashboard_url = "https://your-dashboard.com"
api_key = "your-api-key-here"

[chrome]
# Auto-detected if not specified
# chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

[sessions]
base_directory = "C:\\HairRap\\WhatsAppSessions"

[heartbeat]
interval_seconds = 60

[logging]
level = "INFO"
file = "C:\\HairRap\\launcher.log"
```

#### Step 4: Create Sessions Directory

```powershell
mkdir C:\HairRap\WhatsAppSessions
```

#### Step 5: Test Launcher

```powershell
cd C:\HairRap
python main.py --test
```

Expected output:
```
[INFO] Testing connection to dashboard...
[INFO] Dashboard URL: https://your-dashboard.com
[INFO] Device code: PC-01
[INFO] API key: ****...**** (last 4 chars)
[INFO] Connection successful!
[INFO] Device registered: PC-01 (uuid: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
[INFO] Test complete.
```

#### Step 6: Run Launcher

```powershell
# Foreground (for testing)
python main.py

# Background (production)
pythonw main.py

# Or install as Windows Service (see below)
```

### 4.3 Windows Service Installation (Optional)

#### Option A: Using Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Hair Rap Launcher"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program: `pythonw`
7. Arguments: `C:\HairRap\main.py`
8. Start in: `C:\HairRap`

#### Option B: Using NSSM (Recommended)

```powershell
# Download NSSM: https://nssm.cc/download
# Extract to C:\HairRap\nssm\

# Install service
C:\HairRap\nssm\nssm.exe install HairRapLauncher "C:\Python311\pythonw.exe" "C:\HairRap\main.py"
C:\HairRap\nssm\nssm.exe set HairRapLauncher AppDirectory "C:\HairRap"
C:\HairRap\nssm\nssm.exe set HairRapLauncher DisplayName "Hair Rap Launcher"
C:\HairRap\nssm\nssm.exe set HairRapLauncher Description "Manages WhatsApp Web sessions for Hair Rap"
C:\HairRap\nssm\nssm.exe set HairRapLauncher Start SERVICE_AUTO_START

# Start service
net start HairRapLauncher
```

#### Option C: Using pywin32

```python
# Add to main.py:
import win32serviceutil
import win32service
import win32event

class HairRapLauncherService(win32serviceutil.ServiceFramework):
    _svc_name_ = "HairRapLauncher"
    _svc_display_name_ = "Hair Rap Launcher"
    _svc_description_ = "Manages WhatsApp Web sessions for Hair Rap"
    
    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
    
    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
    
    def SvcDoRun(self):
        main()

if __name__ == '__main__':
    win32serviceutil.HandleCommandLine(HairRapLauncherService)
```

---

## 5. Configuration Reference

### 5.1 Configuration File Format

**File:** `launcher_config.json`

```toml
[launcher]
# Device identification
device_code = "PC-01"                    # Required: Must match dashboard registration
friendly_name = "Main Office Desktop"    # Optional: Display name
dashboard_url = "https://your-dashboard.com"  # Required: Dashboard API URL
api_key = "your-api-key-here"           # Required: API key from dashboard registration

[chrome]
# Chrome/Edge configuration
chrome_path = ""                         # Optional: Auto-detected if empty
# edge_path = ""                         # Optional: Use Edge instead of Chrome
user_data_base = "C:\\HairRap\\WhatsAppSessions"  # Required: Base directory for sessions

[sessions]
# Session management
base_directory = "C:\\HairRap\\WhatsAppSessions"  # Required: Session storage directory
max_sessions = 20                        # Optional: Maximum concurrent sessions

[heartbeat]
# Heartbeat configuration
interval_seconds = 60                    # Optional: Heartbeat interval (default: 60)
timeout_seconds = 30                     # Optional: Request timeout (default: 30)

[logging]
# Logging configuration
level = "INFO"                           # Optional: DEBUG, INFO, WARNING, ERROR
file = "C:\\HairRap\\launcher.log"       # Optional: Log file path
max_size_mb = 10                         # Optional: Max log file size
backup_count = 5                         # Optional: Number of backup logs

[security]
# Security settings
allowed_urls = ["https://web.whatsapp.com"]  # Do not modify
session_code_pattern = "^HR-WA-\\d{4,}$"     # Do not modify
session_dir_prefix = "C:\\HairRap\\WhatsAppSessions\\"  # Do not modify
```

### 5.2 Environment Variables

Override config file values with environment variables:

| Variable | Config Equivalent | Example |
|----------|-------------------|---------|
| `HR_DEVICE_CODE` | `launcher.device_code` | `PC-01` |
| `HR_DASHBOARD_URL` | `launcher.dashboard_url` | `https://dashboard.com` |
| `HR_API_KEY` | `launcher.api_key` | `abc123...` |
| `HR_CHROME_PATH` | `chrome.chrome_path` | `C:\...\chrome.exe` |
| `HR_LOG_LEVEL` | `logging.level` | `DEBUG` |

### 5.3 Command-Line Arguments

```powershell
python main.py [OPTIONS]

Options:
  --config FILE      Path to config file (default: launcher_config.json)
  --test             Test connection and exit
  --register         Register device and exit
  --debug            Enable debug logging
  --help             Show help message
```

---

## 6. Launcher Implementation

### 6.1 Main Loop

```python
#!/usr/bin/env python3
"""
Hair Rap Launcher - WhatsApp Session Manager
"""

import sys
import time
import signal
import logging
from pathlib import Path

from config import Config
from api_client import APIClient
from browser_manager import BrowserManager
from validator import Validator

logger = logging.getLogger(__name__)

class Launcher:
    def __init__(self, config_path: str = "launcher_config.json"):
        self.config = Config(config_path)
        self.api = APIClient(self.config)
        self.browser = BrowserManager(self.config)
        self.validator = Validator(self.config)
        self.running = False
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
    
    def start(self):
        """Start the launcher."""
        logger.info("Starting Hair Rap Launcher...")
        logger.info(f"Device: {self.config.device_code}")
        logger.info(f"Dashboard: {self.config.dashboard_url}")
        
        # Register device if needed
        if not self.api.is_registered():
            self.api.register()
        
        # Start heartbeat thread
        self.running = True
        self._start_heartbeat()
        
        # Main loop - poll for commands
        logger.info("Launcher started. Waiting for commands...")
        while self.running:
            try:
                commands = self.api.get_pending_commands()
                for cmd in commands:
                    self._process_command(cmd)
                time.sleep(5)  # Poll every 5 seconds
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(10)
    
    def check_pending_commands(self):
        """Check for pending commands from dashboard."""
        commands = self.client.get_pending_commands()
        for command in commands:
            logger.info(f"Processing command: {command.get('type')}")
            if command.get('type') == 'launch-whatsapp':
                self.handle_launch_command(command.get('data', {}))

    def handle_launch_command(self, request_data: dict) -> dict:
        """Handle a WhatsApp session launch request."""
        session_id = request_data.get('session_id', 'unknown')
        session_code = request_data.get('session_code', '')
        session_dir = request_data.get('session_directory', '')

        logger.info(f"Launch request: session_code={session_code}, session_dir={session_dir}")

        # Report launching status
        self.client.report_status(session_id, 'launching')

        # Validate request
        is_valid, error_message = validate_launch_request(request_data)
        if not is_valid:
            logger.error(f"Invalid launch request: {error_message}")
            self.client.confirm_whatsapp_launch(session_id, False, error_message)
            self.client.report_status(session_id, 'error', error_message)
            return {"success": False, "error": error_message}

        # Create session directory if needed
        try:
            os.makedirs(session_dir, exist_ok=True)
        except OSError as e:
            error_msg = f"Could not create session directory: {e}"
            logger.error(error_msg)
            self.client.confirm_whatsapp_launch(session_id, False, error_msg)
            self.client.report_status(session_id, 'error', error_msg)
            return {"success": False, "error": error_msg}

        # Launch browser
        target_url = request_data.get('target_url', 'https://web.whatsapp.com/')
        success = launch_whatsapp_session(session_dir, self.browser_path, target_url)

        if success:
            logger.info(f"WhatsApp session launched: {session_code}")
            self.client.confirm_whatsapp_launch(session_id, True)
            self.client.report_status(session_id, 'running')
            return {"success": True, "message": "WhatsApp session launched"}
        else:
            error_msg = "Failed to launch browser"
            logger.error(error_msg)
            self.client.confirm_whatsapp_launch(session_id, False, error_msg)
            self.client.report_status(session_id, 'error', error_msg)
            return {"success": False, "error": error_msg}
    
    def _start_heartbeat(self):
        """Start heartbeat thread."""
        import threading
        
        def heartbeat_loop():
            while self.running:
                try:
                    self.api.send_heartbeat()
                except Exception as e:
                    logger.error(f"Heartbeat error: {e}")
                time.sleep(self.config.heartbeat_interval)
        
        thread = threading.Thread(target=heartbeat_loop, daemon=True)
        thread.start()
    
    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signal."""
        logger.info("Shutting down...")
        self.running = False

def main():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    launcher = Launcher()
    launcher.start()

if __name__ == "__main__":
    main()
```

### 6.2 Browser Manager

```python
"""
Browser Manager - Launches Chrome/Edge with isolated profiles
"""

import subprocess
import shutil
from pathlib import Path

class BrowserManager:
    def __init__(self, config):
        self.config = config
        self.chrome_path = self._find_browser()
    
    def _find_browser(self) -> str:
        """Find Chrome or Edge installation."""
        # Check config first
        if self.config.chrome_path:
            return self.config.chrome_path
        
        # Auto-detect Chrome
        chrome_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ]
        
        for path in chrome_paths:
            if Path(path).exists():
                return path
        
        # Auto-detect Edge
        edge_paths = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ]
        
        for path in edge_paths:
            if Path(path).exists():
                return path
        
        raise FileNotFoundError("Chrome or Edge not found")
    
    def launch_session(self, session_code: str, session_dir: str, target_url: str) -> bool:
        """Launch a WhatsApp session in Chrome."""
        try:
            # Create session directory
            Path(session_dir).mkdir(parents=True, exist_ok=True)
            
            # Build Chrome command
            cmd = [
                self.chrome_path,
                f"--user-data-dir={session_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-extensions",
                target_url
            ]
            
            # Launch Chrome
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            logger.info(f"Chrome launched with PID: {process.pid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to launch Chrome: {e}")
            return False
```

### 6.3 Validator

```python
"""
Validator - Security validation for launcher commands
"""

import re
from pathlib import Path

class Validator:
    ALLOWED_URLS = ["https://web.whatsapp.com"]
    SESSION_DIR_PREFIX = r"C:\HairRap\WhatsAppSessions\"
    SESSION_CODE_PATTERN = r"^HR-WA-\d{4,}$"
    ALLOWED_BROWSERS = ["chrome.exe", "msedge.exe"]
    
    def __init__(self, config):
        self.config = config
        self.device_id = None  # Set during registration
    
    def validate_launch(self, request_data: dict) -> bool:
        """Validate a launch command."""
        checks = [
            self._validate_target_url(request_data.get("target_url")),
            self._validate_session_dir(request_data.get("session_directory")),
            self._validate_session_code(request_data.get("session_code")),
        ]
        
        return all(checks)
    
    def _validate_target_url(self, url: str) -> bool:
        """Validate target URL is allowed."""
        if url not in self.ALLOWED_URLS:
            logger.error(f"Invalid target URL: {url}")
            return False
        return True
    
    def _validate_session_dir(self, session_dir: str) -> bool:
        """Validate session directory path."""
        if not session_dir.startswith(self.SESSION_DIR_PREFIX):
            logger.error(f"Invalid session directory: {session_dir}")
            return False
        
        # Check for path traversal
        if ".." in session_dir:
            logger.error(f"Path traversal detected: {session_dir}")
            return False
        
        return True
    
    def _validate_session_code(self, session_code: str) -> bool:
        """Validate session code format."""
        if not re.match(self.SESSION_CODE_PATTERN, session_code):
            logger.error(f"Invalid session code: {session_code}")
            return False
        return True
    
    def _validate_device_id(self, device_id: str) -> bool:
        """Validate command is for this device."""
        if device_id != self.device_id:
            logger.error(f"Device mismatch: {device_id} != {self.device_id}")
            return False
        return True
```

---

## 7. Troubleshooting

### 7.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Chrome not found" | Chrome not installed or not in PATH | Install Chrome or specify path in config |
| "Connection refused" | Dashboard not reachable | Check dashboard URL and network |
| "Invalid API key" | API key mismatch | Re-register device with correct key |
| "Session directory error" | Permissions issue | Check folder permissions |
| "Device mismatch" | Wrong device ID | Re-register device |

### 7.2 Log Files

**Location:** `C:\HairRap\launcher.log`

**Log Levels:**
- `DEBUG`: Detailed debugging info
- `INFO`: Normal operations
- `WARNING`: Potential issues
- `ERROR`: Failures

**Example log entries:**
```
2026-09-15 10:00:00 - launcher - INFO - Starting Hair Rap Launcher...
2026-09-15 10:00:00 - launcher - INFO - Device: PC-01
2026-09-15 10:00:01 - api_client - INFO - Heartbeat sent successfully
2026-09-15 10:01:01 - api_client - INFO - Heartbeat sent successfully
2026-09-15 10:02:00 - launcher - INFO - Received command: launch-whatsapp
2026-09-15 10:02:00 - validator - INFO - Validation passed
2026-09-15 10:02:01 - browser_manager - INFO - Chrome launched with PID: 12345
```

### 7.3 Diagnostic Commands

```powershell
# Test connection
python main.py --test

# Check version
python main.py --version

# View logs
Get-Content C:\HairRap\launcher.log -Tail 50

# Check if running
Get-Process python* | Where-Object {$_.Path -like "*HairRap*"}

# Restart service
net stop HairRapLauncher
net start HairRapLauncher
```

### 7.4 Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `E001` | Config file not found | Create launcher_config.json |
| `E002` | Invalid config values | Check launcher_config.json syntax |
| `E003` | Dashboard unreachable | Check URL and network |
| `E004` | API key invalid | Re-register device |
| `E005` | Chrome not found | Install Chrome |
| `E006` | Session dir creation failed | Check permissions |
| `E007` | Browser launch failed | Check Chrome installation |
| `E008` | Heartbeat failed | Check network connection |

---

## 8. API Reference

### 8.1 Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/launcher/register` | None | Register device |
| `POST` | `/api/v1/launcher/heartbeat` | API Key | Send heartbeat |
| `GET` | `/api/v1/launcher/whatsapp-launch` | API Key | Poll for launch commands |
| `POST` | `/api/v1/launcher/whatsapp-confirm` | API Key | Confirm link status |
| `POST` | `/api/v1/launcher/whatsapp-status` | API Key | Report status change |

### 8.2 Error Responses

```json
{
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device with code PC-99 not found",
    "status": 404
  }
}
```

---

## 9. Updates and Maintenance

### 9.1 Updating the Launcher

1. Stop the launcher service
2. Backup launcher_config.json
3. Replace main.py with new version
4. Update requirements.txt if needed
5. Run `pip install -r requirements.txt`
6. Start the launcher service

### 9.2 Version Checking

The launcher reports its version in heartbeats. The dashboard can detect outdated versions and alert admins.

### 9.3 Auto-Update (Future)

Future versions may include auto-update functionality:
- Check for updates on startup
- Download and install updates automatically
- Restart launcher after update

---

## 10. Appendix

### A. Complete File Structure

```
C:\HairRap\
├── main.py                  # Main launcher script
├── config.py                # Configuration management module
├── security.py             # Security validation module
├── browser.py              # Browser discovery and launching
├── server.py               # Local HTTP command server
├── api_client.py           # Dashboard API client
├── requirements.txt        # Python dependencies (requests>=2.28.0)
├── launcher_config.json    # Runtime configuration (generated)
├── launcher.log            # Log file (generated at runtime)
├── install.bat             # Service installation script
├── setup.bat               # Setup script
├── start.bat               # Start launcher
├── uninstall.bat           # Uninstall service
└── WhatsAppSessions\       # Session storage
    ├── HR-WA-0001\
    ├── HR-WA-0002\
    └── ...
```

### B. Sample requirements.txt

```
requests>=2.31.0
schedule>=1.2.0
pywin32>=306; sys_platform == 'win32'
```

### C. Sample install.bat

```batch
@echo off
echo Installing Hair Rap Launcher as Windows Service...
echo.

REM Download NSSM if not present
if not exist nssm.exe (
    echo Downloading NSSM...
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'nssm.zip'"
    powershell -Command "Expand-Archive -Path 'nssm.zip' -DestinationPath '.'"
    copy nssm-2.24\win64\nssm.exe .
    rmdir /s /q nssm-2.24
    del nssm.zip
)

REM Install service
nssm.exe install HairRapLauncher "C:\Python311\pythonw.exe" "C:\HairRap\main.py"
nssm.exe set HairRapLauncher AppDirectory "C:\HairRap"
nssm.exe set HairRapLauncher DisplayName "Hair Rap Launcher"
nssm.exe set HairRapLauncher Description "Manages WhatsApp Web sessions for Hair Rap"
nssm.exe set HairRapLauncher Start SERVICE_AUTO_START

echo.
echo Service installed successfully!
echo Run 'net start HairRapLauncher' to start the service.
pause
```

---

## References

- [Phase 2 Contract](../phase2_contract.md)
- [Architecture Document](./PHASE_2_ARCHITECTURE.md)
- [Security Review](./PHASE_2_SECURITY_REVIEW.md)
- [Setup Guide](./PHASE_2_SETUP_AND_ONBOARDING.md)

