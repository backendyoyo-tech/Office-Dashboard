"""
Configuration management for Hair Rap Launcher.
"""

import os
import json
from pathlib import Path

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
CONFIG_FILE_PATH = Path(__file__).parent / "launcher_config.json"


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
    
    if CONFIG_FILE_PATH.exists():
        try:
            with open(CONFIG_FILE_PATH, 'r') as f:
                saved_config = json.load(f)
                config.update(saved_config)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load config file: {e}")
    
    return config


def save_config(config: dict) -> bool:
    """Save configuration to file."""
    try:
        with open(CONFIG_FILE_PATH, 'w') as f:
            json.dump(config, f, indent=2)
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
