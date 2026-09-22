import { effectiveDeviceStatus } from '@/lib/device-state';
import { AppError, ErrorCode, ForbiddenError } from '@/types/errors';

type PlatformDevice = {
  id: string;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'DISABLED';
  enabled: boolean;
  lastSeenAt: Date | null;
  approvalState: 'PENDING' | 'APPROVED' | 'REVOKED';
  supportsPlatformLauncher: boolean;
  launcherApiKeyHash: string | null;
};

/** Phase 3 launches require a live approved PC; Phase 2's UNKNOWN queuing stays separate. */
export function assertApprovedPlatformDevice(device: PlatformDevice, now = new Date()): void {
  if (device.approvalState !== 'APPROVED' || !device.enabled || !device.launcherApiKeyHash) {
    throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Device is not approved for account launch');
  }
  if (!device.supportsPlatformLauncher) {
    throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Launcher must be upgraded before account launch');
  }
  if (effectiveDeviceStatus(device, now) !== 'ONLINE' || !device.lastSeenAt) {
    throw new AppError(ErrorCode.DEVICE_OFFLINE, 'Launcher heartbeat is not current');
  }
}
