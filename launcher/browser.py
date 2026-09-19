"""
Browser discovery and launching for Hair Rap Launcher.
Handles finding and launching Chrome/Edge with isolated WhatsApp sessions.
"""

import subprocess
import os
from pathlib import Path

# Common browser installation paths on Windows
CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
]

EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_browser() -> tuple[str, str]:
    """
    Find Chrome or Edge browser installation.
    
    Returns:
        Tuple of (browser_name, browser_path)
        
    Raises:
        FileNotFoundError: If no supported browser is found
    """
    # Check Chrome first
    for path in CHROME_PATHS:
        if os.path.exists(path):
            return ("chrome", path)
    
    # Check Edge
    for path in EDGE_PATHS:
        if os.path.exists(path):
            return ("edge", path)
    
    raise FileNotFoundError(
        "No supported browser found. Please install Google Chrome or Microsoft Edge."
    )


def launch_whatsapp_session(session_dir: str, browser_path: str, target_url: str = "https://web.whatsapp.com/") -> bool:
    """
    Launch Chrome/Edge with isolated user-data-dir opening WhatsApp Web.
    
    Args:
        session_dir: Path to session directory for isolated user data
        browser_path: Path to browser executable
        target_url: URL to open (must be WhatsApp Web)
        
    Returns:
        True if launched successfully, False otherwise
    """
    # Validate target URL
    if target_url != "https://web.whatsapp.com/" and target_url != "https://web.whatsapp.com":
        print(f"Error: Invalid target URL: {target_url}")
        return False
    
    # Ensure session directory exists
    try:
        os.makedirs(session_dir, exist_ok=True)
    except OSError as e:
        print(f"Error: Could not create session directory: {e}")
        return False
    
    # Build command
    cmd = [
        browser_path,
        f"--user-data-dir={session_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-sync",
        "--disable-translate",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        target_url,
    ]
    
    try:
        # Launch browser process
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
        )
        print(f"Browser launched with PID: {process.pid}")
        print(f"Session directory: {session_dir}")
        return True
    except Exception as e:
        print(f"Error launching browser: {e}")
        return False


def is_browser_running(browser_path: str) -> bool:
    """
    Check if browser process is running.
    
    Args:
        browser_path: Path to browser executable
        
    Returns:
        True if browser is running, False otherwise
    """
    try:
        # Get browser executable name
        browser_name = Path(browser_path).name
        
        # Check if process is running (Windows)
        result = subprocess.run(
            ["tasklist", "/FI", f"IMAGENAME eq {browser_name}"],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
        )
        
        # If browser name appears in output, it's running
        return browser_name.lower() in result.stdout.lower()
    except Exception:
        return False


def get_browser_version(browser_path: str) -> str:
    """
    Get browser version.
    
    Args:
        browser_path: Path to browser executable
        
    Returns:
        Version string or empty string if not found
    """
    try:
        result = subprocess.run(
            [browser_path, "--version"],
            capture_output=True,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
        )
        
        # Parse version from output
        output = result.stdout.strip()
        if output:
            # Extract version number (e.g., "Google Chrome 120.0.6099.110")
            parts = output.split()
            if len(parts) >= 2:
                return parts[-1]
        return ""
    except Exception:
        return ""
