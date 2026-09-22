import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'launcher'))
from platforms import profile_directory, launch_platform_profile


KEY_A = 'a' * 32
KEY_B = 'b' * 32


class PlatformProfileTests(unittest.TestCase):
    def test_two_accounts_get_separate_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'profiles'
            first = profile_directory(KEY_A, root)
            second = profile_directory(KEY_B, root)
            self.assertNotEqual(first, second)
            self.assertEqual(first.parent, root.resolve())

    def test_rejects_untrusted_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            for key in ('../outside', 'A' * 32, 'a' * 31, 'a' * 32 + ';calc', '..\\outside'):
                with self.subTest(key=key):
                    with self.assertRaises(ValueError):
                        profile_directory(key, Path(tmp) / 'profiles')

    def test_rejects_link_outside_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'profiles'
            root.mkdir()
            target = Path(tmp) / 'outside'
            target.mkdir()
            try:
                (root / KEY_A).symlink_to(target, target_is_directory=True)
            except OSError:
                self.skipTest('Windows symlink privilege unavailable')
            with self.assertRaises(ValueError):
                profile_directory(KEY_A, root)

    def test_only_official_url_and_argv_launch(self):
        with tempfile.TemporaryDirectory() as tmp:
            browser = Path(tmp) / 'chrome.exe'
            browser.write_bytes(b'test fixture')
            with patch('platforms.CHROME_PATHS', [str(browser)]), patch('platforms.EDGE_PATHS', []), \
                 patch('platforms.profile_directory', return_value=Path(tmp)), patch('platforms.subprocess.Popen') as popen:
                popen.return_value.pid = 123
                self.assertEqual(launch_platform_profile(KEY_A, 'https://www.instagram.com/', str(browser)), 123)
                args, kwargs = popen.call_args
                self.assertFalse(kwargs['shell'])
                self.assertEqual(args[0][-1], 'https://www.instagram.com/')
                with self.assertRaises(ValueError):
                    launch_platform_profile(KEY_A, 'https://evil.test/', str(browser))
                self.assertEqual(popen.call_count, 1)


if __name__ == '__main__':
    unittest.main()
