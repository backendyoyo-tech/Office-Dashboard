"""
Security validation for Hair Rap Launcher.
Ensures all operations are safe and follow security rules.
"""

import re
from pathlib import Path

# Allowed URLs - ONLY WhatsApp Web
ALLOWED_URLS = ["https://web.whatsapp.com"]

# Session directory prefix - must start with this
SESSION_DIR_PREFIX = r"C:\HairRap\WhatsAppSessions"

# Session code pattern - HR-WA-XXXX format
SESSION_CODE_PATTERN = r"^HR-WA-\d{4,}$"

# Allowed browsers
ALLOWED_BROWSERS = ["chrome.exe", "msedge.exe", "chrome", "msedge"]

# Maximum session code length
MAX_SESSION_CODE_LENGTH = 20

# Safe characters for session directories (alphanumeric, hyphens, underscores, backslashes)
SAFE_PATH_PATTERN = r'^[a-zA-Z0-9\-_\\]+$'


def validate_launch_request(request_data: dict) -> tuple[bool, str]:
    """
    Validate that a launch request is safe to execute.
    
    Args:
        request_data: Dictionary containing launch request data
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # 1. Validate session_code format
    session_code = request_data.get('session_code', '')
    if not session_code:
        return False, "Missing session_code"
    
    if len(session_code) > MAX_SESSION_CODE_LENGTH:
        return False, f"session_code exceeds maximum length of {MAX_SESSION_CODE_LENGTH}"
    
    if not re.match(SESSION_CODE_PATTERN, session_code):
        return False, f"Invalid session_code format. Must match pattern: {SESSION_CODE_PATTERN}"
    
    # 2. Validate session_directory starts with SESSION_DIR_PREFIX
    session_dir = request_data.get('session_directory', '')
    if not session_dir:
        return False, "Missing session_directory"
    
    if not session_dir.startswith(SESSION_DIR_PREFIX):
        return False, f"session_directory must start with {SESSION_DIR_PREFIX}"
    
    # 3. Validate target_url is in ALLOWED_URLS
    target_url = request_data.get('target_url', '')
    if target_url and target_url not in ALLOWED_URLS:
        return False, f"target_url not in allowed URLs: {ALLOWED_URLS}"
    
    # 4. Validate session_directory contains only safe characters
    relative_path = session_dir[len(SESSION_DIR_PREFIX):]
    if relative_path and not re.match(SAFE_PATH_PATTERN, relative_path):
        return False, "session_directory contains unsafe characters"
    
    # 5. No path traversal (..)
    if '..' in session_dir:
        return False, "Path traversal detected (..)"
    
    # Additional: Check for null bytes
    if '\x00' in session_dir:
        return False, "Null byte detected in path"
    
    return True, ""


def validate_session_directory(path: str) -> bool:
    """
    Ensure session directory is safe.
    
    Args:
        path: Directory path to validate
        
    Returns:
        True if path is safe, False otherwise
    """
    # Must start with SESSION_DIR_PREFIX
    if not path.startswith(SESSION_DIR_PREFIX):
        return False
    
    # No .. path traversal
    if '..' in path:
        return False
    
    # Only alphanumeric, hyphens, underscores, backslashes
    relative_path = path[len(SESSION_DIR_PREFIX):]
    if relative_path and not re.match(SAFE_PATH_PATTERN, relative_path):
        return False
    
    # Check for null bytes
    if '\x00' in path:
        return False
    
    # Normalize path and check it's still under prefix
    try:
        normalized = Path(path).resolve()
        prefix_normalized = Path(SESSION_DIR_PREFIX).resolve()
        if not str(normalized).startswith(str(prefix_normalized)):
            return False
    except (ValueError, OSError):
        return False
    
    return True


def sanitize_session_code(session_code: str) -> str:
    """
    Sanitize session code by removing any non-alphanumeric characters except hyphens.
    
    Args:
        session_code: Raw session code
        
    Returns:
        Sanitized session code
    """
    # Remove any characters that aren't alphanumeric or hyphens
    sanitized = re.sub(r'[^a-zA-Z0-9\-]', '', session_code)
    return sanitized[:MAX_SESSION_CODE_LENGTH]


def is_safe_url(url: str) -> bool:
    """
    Check if URL is in the allowed list.
    
    Args:
        url: URL to check
        
    Returns:
        True if URL is allowed, False otherwise
    """
    return url in ALLOWED_URLS


def validate_api_key(api_key: str) -> bool:
    """
    Validate API key format (basic check).
    
    Args:
        api_key: API key to validate
        
    Returns:
        True if format is valid, False otherwise
    """
    if not api_key:
        return False
    
    # API key should be at least 32 characters
    if len(api_key) < 32:
        return False
    
    # Should contain only alphanumeric characters and hyphens
    if not re.match(r'^[a-zA-Z0-9\-_]+$', api_key):
        return False
    
    return True
