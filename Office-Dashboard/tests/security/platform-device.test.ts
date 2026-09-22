import { describe, expect, it } from 'vitest';
import { assertApprovedPlatformDevice } from '../../src/lib/platform-device';

const now = new Date('2026-09-22T10:00:00Z');
const approved = {
  id: 'test-device', status: 'ONLINE' as const, enabled: true,
  lastSeenAt: now, approvalState: 'APPROVED' as const,
  supportsPlatformLauncher: true, launcherApiKeyHash: 'hash',
};

describe('privileged platform device gate', () => {
  it('accepts a current approved capable device', () => {
    expect(() => assertApprovedPlatformDevice(approved, now)).not.toThrow();
  });
  it.each([
    { approvalState: 'PENDING' as const },
    { approvalState: 'REVOKED' as const },
    { enabled: false },
    { supportsPlatformLauncher: false },
    { launcherApiKeyHash: null },
    { status: 'UNKNOWN' as const },
    { status: 'OFFLINE' as const },
    { lastSeenAt: null },
    { lastSeenAt: new Date(now.getTime() - 10 * 60 * 1000) },
  ])('rejects an unready device', change => {
    expect(() => assertApprovedPlatformDevice({ ...approved, ...change }, now)).toThrow();
  });
});
