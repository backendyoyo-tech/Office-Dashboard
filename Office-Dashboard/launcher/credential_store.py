"""Windows user-scoped DPAPI protection for the launcher key, never social credentials."""
import base64
import ctypes
import os
from ctypes import wintypes


class DataBlob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def _crypt(value: bytes, decrypt: bool) -> bytes:
    if os.name != 'nt':
        raise RuntimeError('Launcher credential storage requires Windows DPAPI')
    buffer = (ctypes.c_ubyte * len(value)).from_buffer_copy(value)
    source = DataBlob(len(value), buffer)
    output = DataBlob()
    library = ctypes.WinDLL('crypt32', use_last_error=True)
    function = library.CryptUnprotectData if decrypt else library.CryptProtectData
    function.argtypes = [ctypes.POINTER(DataBlob), ctypes.c_void_p, ctypes.c_void_p,
                         ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DataBlob)]
    function.restype = wintypes.BOOL
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output)):
        raise RuntimeError('Windows could not protect/unprotect the launcher credential')
    try:
        return ctypes.string_at(output.data, output.size)
    finally:
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.LocalFree.argtypes = [ctypes.c_void_p]
        kernel.LocalFree.restype = ctypes.c_void_p
        kernel.LocalFree(output.data)


def protect(value: str) -> str:
    return base64.b64encode(_crypt(value.encode('utf-8'), False)).decode('ascii')


def unprotect(value: str) -> str:
    return _crypt(base64.b64decode(value, validate=True), True).decode('utf-8')
