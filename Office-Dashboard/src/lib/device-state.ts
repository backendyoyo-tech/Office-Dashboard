import { AppError, ErrorCode } from '@/types/errors';

/**
 * Device availability semantics (REPAIR: D-007, D-021, D-026).
 *
 * Canonical device status lifecycle:
 *   UNKNOWN  — provisioned/registered but has not sent a heartbeat yet, OR its
 *              heartbeat is older than the offline threshold and the sweeper has
 *              not run yet. A device in this state MAY still serve a session:
 *              the launcher is reachable even if the dashboard has not seen a
 *              heartbeat (e.g. it just booted, or the network is intermittent).
 *   ONLINE   — a heartbeat was received within the offline threshold.
 *   OFFLINE  — a heartbeat was seen but is now stale (> threshold), or the
 *              device explicitly went away. Sessions CANNOT be launched.
 *   DISABLED — administratively disabled. Sessions CANNOT be launched.
 *
 * Rationale (D-007): the original implementation required `status === 'ONLINE'`,
 * which rejected UNKNOWN devices that were perfectly healthy. That broke the
 * Phase 2 "open session" flow for any device that had not yet heartbeated.
 *
 * Security is NOT weakened by this change:
 *   - `enabled === false` and `status === 'DISABLED'` still hard-block.
 *   - OFFLINE (stale heartbeat) still hard-blocks.
 *   - The launcher must still authenticate with its own API key before it can
 *     actually execute a launch command, so "UNKNOWN" never grants execution —
 *     it only allows the dashboard to *queue* the command.
 */

export type DeviceStatusValue = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'DISABLED';

export const DEVICE_OFFLINE_THRESHOLD_MS = (() => {
  const raw = process.env.DEVICE_OFFLINE_THRESHOLD_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60 * 1000; // 5 minutes
})();

/** Statuses that permit queuing a launch/setup/open/reconnect command. */
const LAUNCHABLE: ReadonlyArray<DeviceStatusValue> = ['ONLINE', 'UNKNOWN'];

export interface DeviceLike {
  id: string;
  deviceCode?: string;
  status: DeviceStatusValue;
  enabled: boolean;
  lastSeenAt?: Date | string | null;
}

/**
 * Resolve the *effective* status, applying the staleness rule without mutating
 * the row (the sweeper persists this; read paths compute it).
 */
export function effectiveDeviceStatus(device: DeviceLike, now: Date = new Date()): DeviceStatusValue {
  if (!device.enabled) return 'DISABLED';
  if (device.status === 'DISABLED') return 'DISABLED';

  if (device.lastSeenAt) {
    const lastSeen = device.lastSeenAt instanceof Date ? device.lastSeenAt : new Date(device.lastSeenAt);
    if (!Number.isNaN(lastSeen.getTime()) && now.getTime() - lastSeen.getTime() > DEVICE_OFFLINE_THRESHOLD_MS) {
      return 'OFFLINE';
    }
  }

  return device.status;
}

/** True when the device may be used to launch a WhatsApp session. */
export function isDeviceLaunchable(device: DeviceLike, now: Date = new Date()): boolean {
  return LAUNCHABLE.includes(effectiveDeviceStatus(device, now));
}

/**
 * Throw the precise error for a device that cannot launch, or return normally.
 * Never returns for DISABLED/OFFLINE devices.
 */
export function assertDeviceLaunchable(device: DeviceLike, now: Date = new Date()): void {
  const status = effectiveDeviceStatus(device, now);

  if (status === 'DISABLED') {
    throw new AppError(
      ErrorCode.DEVICE_DISABLED,
      device.enabled ? 'Assigned device is disabled' : 'Assigned device has been disabled',
    );
  }

  if (status === 'OFFLINE') {
    throw new AppError(
      ErrorCode.DEVICE_OFFLINE,
      `Assigned device ${device.deviceCode ?? device.id} is offline (no heartbeat within ${Math.round(
        DEVICE_OFFLINE_THRESHOLD_MS / 1000,
      )}s). Start the launcher on that PC or wait for it to reconnect.`,
    );
  }
}

/** Human-readable reason a device is not launchable, or null when it is. */
export function deviceBlockingReason(device: DeviceLike, now: Date = new Date()): string | null {
  try {
    assertDeviceLaunchable(device, now);
    return null;
  } catch (err: any) {
    return err?.message ?? 'Device unavailable';
  }
}
