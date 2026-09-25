# """Windows user-scoped DPAPI protection for the launcher key, never social credentials."""
# import base64
# import ctypes
# import os
# from ctypes import wintypes


# class DataBlob(ctypes.Structure):
#     _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


# def _crypt(value: bytes, decrypt: bool) -> bytes:
#     if os.name != 'nt':
#         raise RuntimeError('Launcher credential storage requires Windows DPAPI')
#     buffer = (ctypes.c_ubyte * len(value)).from_buffer_copy(value)
#     source = DataBlob(len(value), buffer)
#     output = DataBlob()
#     library = ctypes.WinDLL('crypt32', use_last_error=True)
#     function = library.CryptUnprotectData if decrypt else library.CryptProtectData
#     function.argtypes = [ctypes.POINTER(DataBlob), ctypes.c_void_p, ctypes.c_void_p,
#                          ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
#     function.restype = wintypes.BOOL
#     if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output)):
#         raise RuntimeError('Windows could not protect/unprotect the launcher credential')
#     try:
#         return ctypes.string_at(output.data, output.size)
#     finally:
#         kernel = ctypes.WinDLL('kernel32', use_last_error=True)
#         kernel.LocalFree.argtypes = [ctypes.c_void_p]
#         kernel.LocalFree.restype = ctypes.c_void_p
#         kernel.LocalFree(output.data)


# def protect(value: str) -> str:
#     return base64.b64encode(_crypt(value.encode('utf-8'), False)).decode('ascii')


# def unprotect(value: str) -> str:
#     return _crypt(base64.b64decode(value, validate=True), True).decode('utf-8')




"""Windows user-scoped DPAPI protection for launcher credentials.

This module protects only launcher credentials.
It never stores social-media passwords, OTPs, cookies, or sessions.
"""

import base64
import ctypes
import json
import os
from pathlib import Path
from ctypes import wintypes


class DataBlob(ctypes.Structure):
    _fields_ = [
        ("size", wintypes.DWORD),
        ("data", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def _crypt(value: bytes, decrypt: bool) -> bytes:
    if os.name != "nt":
        raise RuntimeError(
            "Launcher credential storage requires Windows DPAPI"
        )

    buffer = (ctypes.c_ubyte * len(value)).from_buffer_copy(value)
    source = DataBlob(len(value), buffer)
    output = DataBlob()

    library = ctypes.WinDLL("crypt32", use_last_error=True)

    function = (
        library.CryptUnprotectData
        if decrypt
        else library.CryptProtectData
    )

    function.argtypes = [
        ctypes.POINTER(DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(DataBlob),
    ]

    function.restype = wintypes.BOOL

    if not function(
        ctypes.byref(source),
        None,
        None,
        None,
        None,
        1,
        ctypes.byref(output),
    ):
        raise RuntimeError(
            "Windows could not protect/unprotect the launcher credential"
        )

    try:
        return ctypes.string_at(output.data, output.size)
    finally:
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.LocalFree.argtypes = [ctypes.c_void_p]
        kernel.LocalFree.restype = ctypes.c_void_p
        kernel.LocalFree(output.data)


def protect(value: str) -> str:
    return base64.b64encode(
        _crypt(value.encode("utf-8"), False)
    ).decode("ascii")


def unprotect(value: str) -> str:
    return _crypt(
        base64.b64decode(value, validate=True),
        True,
    ).decode("utf-8")


# ---------------------------------------------------------------------------
# Launcher credential file
# ---------------------------------------------------------------------------

def _credential_file() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")

    if not local_app_data:
        raise RuntimeError("LOCALAPPDATA is not available")

    directory = Path(local_app_data) / "HairRap"
    directory.mkdir(parents=True, exist_ok=True)

    return directory / "launcher_credentials.dat"


def save_launcher_credentials(device_id: str, api_key: str) -> None:
    """Save device ID + launcher API key using Windows DPAPI."""

    if not device_id or not api_key:
        raise ValueError("device_id and api_key are required")

    payload = json.dumps(
        {
            "device_id": device_id,
            "api_key": api_key,
        },
        separators=(",", ":"),
    )

    encrypted = protect(payload)

    path = _credential_file()

    temporary = path.with_suffix(".tmp")

    temporary.write_text(
        encrypted,
        encoding="utf-8",
    )

    os.replace(temporary, path)


def load_launcher_credentials() -> dict:
    """Load and decrypt launcher credentials."""

    path = _credential_file()

    if not path.exists():
        return {
            "device_id": "",
            "api_key": "",
        }

    encrypted = path.read_text(
        encoding="utf-8"
    ).strip()

    if not encrypted:
        return {
            "device_id": "",
            "api_key": "",
        }

    payload = json.loads(
        unprotect(encrypted)
    )

    return {
        "device_id": payload.get("device_id", ""),
        "api_key": payload.get("api_key", ""),
    }


def clear_launcher_credentials() -> None:
    """Delete locally stored launcher credentials."""

    path = _credential_file()

    try:
        path.unlink()
    except FileNotFoundError:
        pass