"""Connect this PC using the existing dashboard-admin device registration workflow."""
import getpass
import uuid
from urllib.parse import urlsplit
from config import load_config, save_config
from api_client import DashboardClient


def validate_backend_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('Use the dashboard API origin without credentials, query or path')
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1')):
        raise ValueError('Use HTTPS, or localhost HTTP for development')
    if not parsed.hostname:
        raise ValueError('Dashboard API hostname is required')
    return value.rstrip('/')


def main():
    config = load_config()
    print('In Dashboard > Devices, register this PC and copy its device ID and one-time displayed launcher API key.')
    print('Use the existing device key if this PC is already registered. Never enter Instagram credentials here.')
    config['dashboard_url'] = validate_backend_url(input('Backend origin [http://localhost:3001]: ').strip() or 'http://localhost:3001')
    config['device_id'] = str(uuid.UUID(input('Registered device ID: ').strip()))
    key = getpass.getpass('Launcher API key (hidden): ').strip()
    if not key.startswith('hr_launcher_') or len(key) < 32:
        raise ValueError('A dashboard-issued launcher API key is required')
    config['api_key'] = key
    origin = input('Dashboard browser origin [http://localhost:3000]: ').strip() or 'http://localhost:3000'
    config['dashboard_origins'] = [validate_backend_url(origin)]
    client = DashboardClient(config['dashboard_url'], key, config['device_id'])
    result = client.heartbeat()
    if result.get('status') != 'ok':
        raise RuntimeError('Device credential was rejected or backend is unavailable')
    if result.get('deviceId') != config['device_id']:
        raise RuntimeError('API key belongs to a different registered device')
    if not save_config(config):
        raise RuntimeError('Could not save protected configuration')
    print('Saved with Windows DPAPI. Approve this PC in Dashboard > Devices, then run start.bat.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError) as error:
        raise SystemExit(str(error))
