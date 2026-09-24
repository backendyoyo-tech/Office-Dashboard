"""
Configuration management for Hair Rap Launcher.
"""

import os
import json
from pathlib import Path
from credential_store import protect, unprotect

# Dashboard API URL
DASHBOARD_URL = "http://localhost:3001"

# API Key - Set during registration
API_KEY = ""

# Device ID - Set during registration
DEVICE_ID = ""

# Device Code - e.g., "PC-01"
DEVICE_CODE = ""

# Friendly Name - e.g., "Main Office Desktop"
FRIENDLY_NAME = ""

# Heartbeat interval in seconds
HEARTBEAT_INTERVAL = 60

# Base path for WhatsApp sessions
SESSION_BASE_PATH = r"C:\HairRap\WhatsAppSessions"

# Local server port (0 = random available port)
LOCAL_SERVER_PORT = 12345
DASHBOARD_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

# Config file path
LEGACY_CONFIG_FILE_PATH = Path(__file__).parent / "launcher_config.json"
CONFIG_FILE_PATH = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'HairRap' / 'launcher.json'


def load_config() -> dict:
    """Load configuration from file or return defaults."""
    config = {
        "dashboard_url": DASHBOARD_URL,
        "api_key": API_KEY,
        "device_id": DEVICE_ID,
        "device_code": DEVICE_CODE,
        "friendly_name": FRIENDLY_NAME,
        "heartbeat_interval": HEARTBEAT_INTERVAL,
        "session_base_path": SESSION_BASE_PATH,
        "local_server_port": LOCAL_SERVER_PORT,
        "dashboard_origins": DASHBOARD_ORIGINS,
    }
    
    source = CONFIG_FILE_PATH if CONFIG_FILE_PATH.exists() else LEGACY_CONFIG_FILE_PATH
    if source.exists():
        try:
            with open(source, 'r', encoding='utf-8') as f:
                saved_config = json.load(f)
                encrypted = saved_config.pop('api_key_protected', None)
                if encrypted:
                    saved_config['api_key'] = unprotect(encrypted)
                config.update(saved_config)
            if source == LEGACY_CONFIG_FILE_PATH and config.get('api_key'):
                if not save_config(config):
                    raise RuntimeError('Could not migrate launcher credential to protected storage')
                saved_config.pop('api_key', None)
                source.write_text(json.dumps(saved_config, indent=2), encoding='utf-8')
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load config file: {e}")
    
    return config


def save_config(config: dict) -> bool:
    """Save configuration to file."""
    try:
        stored = dict(config)
        key = stored.pop('api_key', '')
        stored.pop('api_key_protected', None)
        if key:
            stored['api_key_protected'] = protect(key)
        CONFIG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary = CONFIG_FILE_PATH.with_suffix('.tmp')
        temporary.write_text(json.dumps(stored, indent=2), encoding='utf-8')
        os.replace(temporary, CONFIG_FILE_PATH)
        return True
    except IOError as e:
        print(f"Error: Could not save config file: {e}")
        return False


def update_config_value(key: str, value) -> bool:
    """Update a single configuration value."""
    config = load_config()
    config[key] = value
    return save_config(config)


def get_config_value(key: str, default=None):
    """Get a single configuration value."""
    config = load_config()
    return config.get(key, default)
