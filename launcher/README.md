# Hair Rap Launcher

A Windows local launcher/helper application for managing isolated WhatsApp Web browser sessions.

## Overview

The Hair Rap Launcher is a Python-based Windows application that:
- Manages isolated WhatsApp Web browser sessions
- Communicates with the Hair Rap Dashboard backend
- Provides secure, sandboxed browser launching
- Runs as a Windows startup service

## Features

- **Isolated Sessions**: Each WhatsApp session runs in its own Chrome/Edge user-data-dir
- **Security First**: Validates all inputs, prevents path traversal, only allows WhatsApp Web
- **Dashboard Integration**: Communicates with Hair Rap Dashboard via REST API
- **Auto-Start**: Can be installed as a Windows startup task
- **Audit Logging**: All operations are logged for security and debugging

## Prerequisites

- Windows 10/11
- Python 3.11 or later
- Google Chrome or Microsoft Edge
- Hair Rap Dashboard running (default: http://localhost:3001)

## Quick Start

### 1. Setup

Run the interactive setup script:

```batch
setup.bat
```

This will:
- Check Python installation
- Install dependencies
- Configure dashboard URL
- Register your device with the dashboard

### 2. Install as Startup (Optional)

To run the launcher automatically on Windows login:

```batch
install.bat
```

**Note**: Requires administrator privileges.

### 3. Start Manually

To start the launcher manually:

```batch
start.bat
```

Or run directly:

```bash
python main.py
```

## Configuration

The launcher configuration is stored in `launcher_config.json`:

```json
{
  "dashboard_url": "http://localhost:3001",
  "api_key": "your-api-key-here",
  "device_id": "device-uuid",
  "device_code": "PC-01",
  "friendly_name": "Main Office Desktop",
  "heartbeat_interval": 60,
  "session_base_path": "C:\\HairRap\\WhatsAppSessions",
  "local_server_port": 12345
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `dashboard_url` | Dashboard API URL | http://localhost:3001 |
| `api_key` | API key for authentication | (set during registration) |
| `device_id` | Device ID (UUID) | (set during registration) |
| `device_code` | Device code (e.g., PC-01) | (required) |
| `friendly_name` | Human-readable device name | (required) |
| `heartbeat_interval` | Heartbeat interval in seconds | 60 |
| `session_base_path` | Base directory for WhatsApp sessions | C:\HairRap\WhatsAppSessions |
| `local_server_port` | Local server port (0 = random) | 0 |

## File Structure

```
launcher/
├── config.py           # Configuration management
├── security.py         # Security validation
├── browser.py          # Browser discovery and launching
├── api_client.py       # Dashboard API communication
├── server.py           # Local HTTP server for commands
├── main.py             # Main launcher application
├── setup.bat           # Interactive setup script
├── install.bat         # Install as startup task
├── uninstall.bat       # Remove startup task
├── start.bat           # Start launcher manually
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

## How It Works

### Registration

1. On first run, the launcher registers with the dashboard
2. Dashboard provides an API key and device ID
3. Configuration is saved to `launcher_config.json`

### Operation

1. **Heartbeat**: Sends heartbeat to dashboard every 60 seconds
2. **Local Server**: Runs HTTP server on localhost for receiving commands
3. **Command Processing**: Receives launch commands from dashboard
4. **Browser Launch**: Launches Chrome/Edge with isolated user-data-dir
5. **Status Reporting**: Reports session status back to dashboard

### Session Isolation

Each WhatsApp session uses:
- Separate Chrome/Edge user-data-dir
- No shared cookies or data between sessions
- Isolated browser profile

## Security

### Security Rules

1. **URL Validation**: Only `https://web.whatsapp.com` is allowed
2. **Path Validation**: Session directories must be under `C:\HairRap\WhatsAppSessions\`
3. **Code Validation**: Session codes must match pattern `HR-WA-XXXX`
4. **Path Traversal Prevention**: Blocks `..` in paths
5. **Localhost Only**: Server only accepts connections from 127.0.0.1
6. **API Key Validation**: Every request requires valid API key
7. **Input Sanitization**: All inputs are validated and sanitized

### What the Launcher Does NOT Do

- Does NOT read WhatsApp data, cookies, or messages
- Does NOT inject code into WhatsApp Web
- Does NOT execute arbitrary commands
- Does NOT access files outside session directories
- Does NOT make external network requests (except to dashboard)

## API Endpoints

The local server exposes:

### POST /launch-whatsapp

Launch a WhatsApp session.

**Headers:**
```
Authorization: Bearer <api-key>
Content-Type: application/json
```

**Body:**
```json
{
  "session_code": "HR-WA-0001",
  "session_directory": "C:\\HairRap\\WhatsAppSessions\\HR-WA-0001",
  "session_id": "uuid-here",
  "target_url": "https://web.whatsapp.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp session launched"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "hair-rap-launcher",
  "device_id": "device-uuid",
  "browser": "chrome",
  "browser_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "server_port": 12345,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Troubleshooting

### Browser Not Found

**Error:** `No supported browser found`

**Solution:** Install Google Chrome or Microsoft Edge.

### Registration Failed

**Error:** `Registration failed`

**Solution:**
1. Ensure dashboard is running at the configured URL
2. Check network connectivity
3. Verify dashboard URL in `launcher_config.json`

### Port Already in Use

**Error:** `Address already in use`

**Solution:**
1. Stop other instances of the launcher
2. Or set a specific port in `launcher_config.json`:
   ```json
   "local_server_port": 12345
   ```

### Permission Denied

**Error:** `Permission denied` when creating directories

**Solution:**
1. Run as administrator
2. Or change `session_base_path` to a user-writable location

## Uninstallation

### Remove Startup Task

```batch
uninstall.bat
```

### Manual Cleanup

1. Delete `launcher_config.json`
2. Delete `launcher.log`
3. Delete `C:\HairRap\WhatsAppSessions\` (optional)

## Development

### Running in Development Mode

```bash
# Install dependencies
pip install -r requirements.txt

# Run with verbose logging
python main.py
```

### Testing

```bash
# Test security validation
python -c "from security import validate_launch_request; print(validate_launch_request({'session_code': 'HR-WA-0001', 'session_directory': 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001'}))"

# Test browser discovery
python -c "from browser import find_browser; print(find_browser())"
```

## Logs

Logs are written to:
- Console (stdout)
- `launcher.log` file

Log levels:
- INFO: Normal operations
- WARNING: Non-critical issues
- ERROR: Failures and security violations
- DEBUG: Detailed debugging information

## License

Part of the Hair Rap by YOYO project.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review `launcher.log` for error details
3. Contact the Hair Rap development team
