import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent, logWhatsAppAudit } from '@/middleware/audit';
import { Request } from 'express';
import type { PaginationInput } from '@/validation/common';

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
        status: d.status,
        launcherVersion: d.launcherVersion,
        lastSeenAt: d.lastSeenAt,
        enabled: d.enabled,
        createdBy: d.creator,
        whatsappSessionCount: d._count.whatsappSessions,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        totalCount,
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
      createdBy: device.creator,
      whatsappSessions: device.whatsappSessions,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  async create(data: {
    deviceCode: string;
    friendlyName: string;
    hostname?: string;
  }, req: Request) {
    // Check for duplicate device code
    const existing = await prisma.registeredDevice.findUnique({
      where: { deviceCode: data.deviceCode },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.DEVICE_CODE_DUPLICATE, 'A device with this code already exists');
    }

    const device = await prisma.registeredDevice.create({
      data: {
        deviceCode: data.deviceCode,
        friendlyName: data.friendlyName,
        hostname: data.hostname,
        status: 'UNKNOWN',
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

    return device;
  }

  async update(id: string, data: {
    friendlyName?: string;
    hostname?: string;
    enabled?: boolean;
  }, req: Request) {
    const device = await prisma.registeredDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    }

    const updated = await prisma.registeredDevice.update({
      where: { id },
      data: {
        ...(data.friendlyName !== undefined && { friendlyName: data.friendlyName }),
        ...(data.hostname !== undefined && { hostname: data.hostname }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'DEVICE_UPDATED',
      entityType: 'DEVICE',
      entityId: id,
      metadata: { changedFields: Object.keys(data) },
      req,
    });

    return updated;
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
}

export const devicesService = new DevicesService();
