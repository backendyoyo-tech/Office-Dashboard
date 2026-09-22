"""Strict local profile isolation for the multi-platform launcher."""

import os
import re
import stat
import subprocess
from pathlib import Path

from browser import CHROME_PATHS, EDGE_PATHS


OFFICIAL_URLS = frozenset({
    'https://web.whatsapp.com/',
    'https://www.instagram.com/',
    'https://www.facebook.com/',
    'https://www.youtube.com/',
    'https://web.telegram.org/',
    'https://www.pinterest.com/',
    'https://x.com/',
    'https://www.linkedin.com/',
    'https://mail.google.com/',
})
PROFILE_KEY = re.compile(r'^[a-f0-9]{32}$')


def fixed_profile_root() -> Path:
    local_app_data = os.environ.get('LOCALAPPDATA')
    if not local_app_data:
        raise ValueError('LOCALAPPDATA is required for platform profiles')
    return Path(local_app_data) / 'HairRap' / 'PlatformProfiles'


def _is_reparse_point(path: Path) -> bool:
    if not path.exists() and not path.is_symlink():
        return False
    if path.is_symlink():
        return True
    if os.name == 'nt':
        return bool(path.stat(follow_symlinks=False).st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    return False


def profile_directory(profile_key: str, root: Path | None = None) -> Path:
    """Create a profile directly under the fixed root, rejecting links and escape."""
    if not PROFILE_KEY.fullmatch(profile_key):
        raise ValueError('Invalid opaque profile key')
    root = root or fixed_profile_root()
    for ancestor in (root, *root.parents):
        if _is_reparse_point(ancestor):
            raise ValueError('Profile root ancestry cannot contain a link')
    if _is_reparse_point(root):
        raise ValueError('Profile root cannot be a link')
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    resolved_root = root.resolve(strict=True)
    if _is_reparse_point(root):
        raise ValueError('Profile root cannot be a link')
    child = root / profile_key
    if _is_reparse_point(child):
        raise ValueError('Profile directory cannot be a link')
    child.mkdir(exist_ok=True, mode=0o700)
    resolved_child = child.resolve(strict=True)
    if _is_reparse_point(child) or resolved_child.parent != resolved_root:
        raise ValueError('Profile directory escaped the fixed root')
    return resolved_child


def launch_platform_profile(profile_key: str, target_url: str, browser_path: str) -> int:
    """Launch only a fixed official URL with an isolated opaque local profile."""
    if target_url not in OFFICIAL_URLS:
        raise ValueError('Target URL is not an approved official home')
    allowed_binaries = {str(Path(path).resolve()) for path in CHROME_PATHS + EDGE_PATHS}
    browser = Path(browser_path)
    if not browser.is_file() or _is_reparse_point(browser) or str(browser.resolve()) not in allowed_binaries:
        raise ValueError('Browser executable is not an approved installation')
    directory = profile_directory(profile_key)
    command = [
        str(browser), f'--user-data-dir={directory}', '--no-first-run',
        '--no-default-browser-check', '--disable-sync', target_url,
    ]
    process = subprocess.Popen(
        command, shell=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
    )
    return process.pid
