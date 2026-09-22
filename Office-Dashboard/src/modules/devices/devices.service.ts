import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent, logWhatsAppAudit } from '@/middleware/audit';
import { Request } from 'express';
import type { PaginationInput } from '@/validation/common';
import { updateWithVersion } from '@/lib/concurrency';
import {
  DEVICE_OFFLINE_THRESHOLD_MS,
  effectiveDeviceStatus,
  type DeviceStatusValue,
} from '@/lib/device-state';

/**
 * Devices service — registered device management (Phase 2).
 */
export class DevicesService {
  async list(params: PaginationInput & {
    search?: string;
    status?: string;
    enabled?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { page, pageSize, search, status, enabled, sortBy, sortOrder } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.OR = [
        { deviceCode: { contains: search, mode: 'insensitive' } },
        { friendlyName: { contains: search, mode: 'insensitive' } },
        { hostname: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (enabled !== undefined) where.enabled = enabled;

    const orderBy: any = {};
    orderBy[sortBy ?? 'createdAt'] = sortOrder ?? 'desc';

    const [data, totalCount] = await Promise.all([
      prisma.registeredDevice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          creator: { select: { id: true, fullName: true } },
          _count: { select: { whatsappSessions: true } },
        },
      }),
      prisma.registeredDevice.count({ where }),
    ]);

    return {
      data: data.map(d => ({
        id: d.id,
        deviceCode: d.deviceCode,
        friendlyName: d.friendlyName,
        hostname: d.hostname,
        // REPAIR D-026 — report the *effective* status (a device with a stale
        // heartbeat reads as OFFLINE even before the sweeper persists it).
        status: effectiveDeviceStatus(d) as DeviceStatusValue,
        storedStatus: d.status,
        launcherVersion: d.launcherVersion,
        lastSeenAt: d.lastSeenAt,
        enabled: d.enabled,
        approvalState: d.approvalState,
        supportsPlatformLauncher: d.supportsPlatformLauncher,
        // REPAIR D-006 — optimistic-locking token.
        version: d.version,
        createdBy: d.creator,
        whatsappSessionCount: d._count.whatsappSessions,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: page * pageSize < totalCount,
        hasPrevPage: page > 1,
      },
    };
  }

  async getById(id: string) {
    const device = await prisma.registeredDevice.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, fullName: true } },
        whatsappSessions: {
          select: {
            id: true,
            sessionCode: true,
            status: true,
            phoneNumber: { select: { id: true, e164Number: true, label: true } },
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    }

    return {
      id: device.id,
      deviceCode: device.deviceCode,
      friendlyName: device.friendlyName,
      hostname: device.hostname,
      status: device.status,
      launcherVersion: device.launcherVersion,
      lastSeenAt: device.lastSeenAt,
      enabled: device.enabled,
      approvalState: device.approvalState,
      supportsPlatformLauncher: device.supportsPlatformLauncher,
      version: device.version,
      createdBy: device.creator,
      whatsappSessions: device.whatsappSessions,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  async create(data: {
    deviceCode?: string;
    friendlyName: string;
    hostname?: string;
  }, req: Request) {
    // Auto-generate device code if not provided
    let deviceCode = data.deviceCode;
    if (!deviceCode) {
      const count = await prisma.registeredDevice.count();
      deviceCode = `PC-${String(count + 1).padStart(2, '0')}`;
    }

    // Check for duplicate device code
    const existing = await prisma.registeredDevice.findUnique({
      where: { deviceCode },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.DEVICE_CODE_DUPLICATE, 'A device with this code already exists');
    }

    // Generate launcher API key (raw key shown once, hash stored)
    const rawKey = `hr_launcher_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const device = await prisma.registeredDevice.create({
      data: {
        deviceCode,
        friendlyName: data.friendlyName,
        hostname: data.hostname,
        status: 'UNKNOWN',
        launcherApiKeyHash: keyHash,
        createdBy: req.user!.id,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'DEVICE_REGISTERED',
      entityType: 'DEVICE',
      entityId: device.id,
      metadata: { deviceCode: device.deviceCode, hostname: device.hostname },
      req,
    });

    // Return device with raw API key (shown only once)
    // Note: launcherApiKeyHash is intentionally excluded from response
    return {
      id: device.id,
      deviceCode: device.deviceCode,
      friendlyName: device.friendlyName,
      hostname: device.hostname,
      status: device.status,
      launcherVersion: device.launcherVersion,
      lastSeenAt: device.lastSeenAt,
      enabled: device.enabled,
      createdBy: device.createdBy,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      apiKey: rawKey,
    };
  }

  async approveLauncher(id: string, version: number, req: Request) {
    const device = await prisma.registeredDevice.findUnique({ where: { id } });
    if (!device) throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    if (!device.enabled || !device.launcherApiKeyHash || device.approvalState === 'REVOKED') {
      throw new ConflictError(ErrorCode.FORBIDDEN, 'Device must be paired and enabled before approval');
    }
    const updated = await updateWithVersion({
      model: 'registeredDevice', id, expectedVersion: version,
      data: { approvalState: 'APPROVED' },
    });
    await logAuditEvent({
      actorUserId: req.user!.id, action: 'DEVICE_APPROVED', entityType: 'DEVICE', entityId: id,
      metadata: { capability: 'platform-launcher', version: updated.version }, req,
    });
    return { id: updated.id, approvalState: updated.approvalState, supportsPlatformLauncher: updated.supportsPlatformLauncher, version: updated.version };
  }

  async revokeLauncher(id: string, version: number, req: Request) {
    const result = await prisma.$transaction(async tx => {
      const changed = await tx.registeredDevice.updateMany({
        where: { id, version },
        data: {
          approvalState: 'REVOKED', supportsPlatformLauncher: false,
          enabled: false, status: 'DISABLED', launcherApiKeyHash: null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.registeredDevice.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
        throw new ConflictError(ErrorCode.CONCURRENCY_CONFLICT, 'Device was changed; refresh and retry');
      }
      await tx.launchGrant.updateMany({ where: { deviceId: id, consumedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.launchTicket.updateMany({ where: { deviceId: id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.registeredDevice.findUniqueOrThrow({ where: { id }, select: { id: true, approvalState: true, version: true } });
    });
    await logAuditEvent({
      actorUserId: req.user!.id, action: 'DEVICE_REVOKED', entityType: 'DEVICE', entityId: id,
      metadata: { capability: 'platform-launcher', version: result.version }, req,
    });
    return result;
  }

  async update(id: string, data: {
    friendlyName?: string;
    hostname?: string;
    enabled?: boolean;
    version?: number;
  }, req: Request) {
    const device = await prisma.registeredDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    }

    const { version: expectedVersion, ...fields } = data;

    // REPAIR D-006 — version-checked write.
    const updated = await updateWithVersion({
      model: 'registeredDevice',
      id,
      expectedVersion,
      data: {
        ...(fields.friendlyName !== undefined && { friendlyName: fields.friendlyName }),
        ...(fields.hostname !== undefined && { hostname: fields.hostname }),
        ...(fields.enabled !== undefined && { enabled: fields.enabled }),
        // Re-enabling a device clears the DISABLED status.
        ...(fields.enabled === true && device.status === 'DISABLED' ? { status: 'UNKNOWN' as const } : {}),
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'DEVICE_UPDATED',
      entityType: 'DEVICE',
      entityId: id,
      metadata: { changedFields: Object.keys(fields), previousVersion: device.version, newVersion: updated.version },
      req,
    });

    return {
      ...updated,
      status: effectiveDeviceStatus(updated),
      storedStatus: updated.status,
    };
  }

  /**
   * Soft-disable a device.
   * Sets enabled=false and archives associated WA sessions.
   */
  async disable(id: string, req: Request) {
    const device = await prisma.registeredDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    }

    const updated = await prisma.registeredDevice.update({
      where: { id },
      data: {
        enabled: false,
        status: 'DISABLED',
      },
    });

    // Archive associated WA sessions that aren't already disabled
    await prisma.whatsappSession.updateMany({
      where: {
        deviceId: id,
        status: { not: 'DISABLED' },
      },
      data: { status: 'DISABLED' },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'DEVICE_DISABLED',
      entityType: 'DEVICE',
      entityId: id,
      req,
    });

    return updated;
  }

  /**
   * Process heartbeat from launcher.
   * Updates device status, launcher version, hostname, and last seen time.
   */
  async heartbeat(deviceId: string, data: {
    launcherVersion?: string;
    hostname?: string;
  }) {
    const device = await prisma.registeredDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    }

    if (!device.enabled) {
      throw new AppError(ErrorCode.DEVICE_DISABLED, 'Device has been disabled');
    }

    const updated = await prisma.registeredDevice.update({
      where: { id: deviceId },
      data: {
        status: 'ONLINE',
        lastSeenAt: new Date(),
        ...(data.launcherVersion && { launcherVersion: data.launcherVersion }),
        ...(data.hostname && { hostname: data.hostname }),
      },
    });

    await logWhatsAppAudit({
      deviceId,
      action: 'DEVICE_HEARTBEAT',
      metadata: { launcherVersion: data.launcherVersion },
    });

    return {
      id: updated.id,
      deviceCode: updated.deviceCode,
      status: updated.status,
      lastSeenAt: updated.lastSeenAt,
    };
  }

  /**
   * REPAIR D-026 — stale-heartbeat sweeper.
   *
   * A device that stops heartbeating previously stayed `ONLINE` forever, so the
   * dashboard lied about availability and `open()` happily queued commands at a
   * PC that was switched off. This sweeper flips any enabled device whose
   * `lastSeenAt` is older than `DEVICE_OFFLINE_THRESHOLD_MS` to `OFFLINE`.
   *
   * It is invoked:
   *  - periodically by the server process (`startDeviceSweeper`), and
   *  - on demand via `POST /devices/sweep` (ADMIN) so QA can prove it works.
   *
   * Devices that have NEVER heartbeated (`lastSeenAt === null`) are left as
   * UNKNOWN: they are not proven dead, and UNKNOWN is launchable per D-007.
   */
  async markStaleDevicesOffline(now: Date = new Date()): Promise<{ swept: number; thresholdMs: number }> {
    const cutoff = new Date(now.getTime() - DEVICE_OFFLINE_THRESHOLD_MS);

    const stale = await prisma.registeredDevice.findMany({
      where: {
        enabled: true,
        status: 'ONLINE',
        lastSeenAt: { not: null, lt: cutoff },
      },
      select: { id: true, deviceCode: true, lastSeenAt: true },
    });

    if (stale.length === 0) {
      return { swept: 0, thresholdMs: DEVICE_OFFLINE_THRESHOLD_MS };
    }

    await prisma.registeredDevice.updateMany({
      where: { id: { in: stale.map(d => d.id) } },
      data: { status: 'OFFLINE' },
    });

    for (const device of stale) {
      await logWhatsAppAudit({
        deviceId: device.id,
        action: 'DEVICE_WENT_OFFLINE',
        metadata: {
          deviceCode: device.deviceCode,
          lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
          thresholdMs: DEVICE_OFFLINE_THRESHOLD_MS,
        },
      });
    }

    return { swept: stale.length, thresholdMs: DEVICE_OFFLINE_THRESHOLD_MS };
  }
}

/**
 * Periodically persist the OFFLINE transition (REPAIR D-026).
 * Returns a stop function. Interval defaults to the offline threshold / 5,
 * clamped to [30s, 5min].
 */
export function startDeviceSweeper(intervalMs?: number): () => void {
  const raw = intervalMs ?? Math.round(DEVICE_OFFLINE_THRESHOLD_MS / 5);
  const interval = Math.min(Math.max(raw, 30_000), 300_000);

  const timer = setInterval(() => {
    devicesService.markStaleDevicesOffline().catch(err => {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Device stale-sweep failed:', err);
      }
    });
  }, interval);

  // Do not keep the event loop alive purely for the sweeper.
  if (typeof (timer as any).unref === 'function') (timer as any).unref();

  return () => clearInterval(timer);
}

export const devicesService = new DevicesService();
