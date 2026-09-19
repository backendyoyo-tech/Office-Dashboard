import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError } from '@/types/errors';
import { logWhatsAppAudit } from '@/middleware/audit';

/**
 * Launcher service — Phase 2 launcher communication protocol.
 * Handles device registration via launcher, heartbeat, and command delivery.
 */
export class LauncherService {
  /**
   * Generate a launcher API key.
   * Returns the raw key (shown once) and the hash (stored in DB).
   */
  generateApiKey(): { rawKey: string; hash: string } {
    const rawKey = `hr_launcher_${crypto.randomBytes(32).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return { rawKey, hash };
  }

  /**
   * Register/claim a device from the launcher.
   * If deviceCode exists, it updates the API key hash.
   * If not, it creates a new device.
   */
  async registerDevice(data: {
    deviceCode: string;
    friendlyName: string;
    hostname?: string;
    launcherVersion?: string;
  }) {
    // Check if device already exists
    let device = await prisma.registeredDevice.findUnique({
      where: { deviceCode: data.deviceCode },
    });

    const { rawKey, hash } = this.generateApiKey();

    if (device) {
      // Re-register: update the API key hash and launcher info
      device = await prisma.registeredDevice.update({
        where: { id: device.id },
        data: {
          launcherApiKeyHash: hash,
          launcherVersion: data.launcherVersion,
          hostname: data.hostname ?? device.hostname,
          status: 'ONLINE',
          lastSeenAt: new Date(),
          enabled: true,
        },
      });

      await logWhatsAppAudit({
        deviceId: device.id,
        action: 'DEVICE_REGISTERED',
        metadata: { deviceCode: data.deviceCode, reRegistered: true },
      });

      return {
        deviceId: device.id,
        deviceCode: device.deviceCode,
        apiKey: rawKey,
        reRegistered: true,
      };
    }

    // Find any admin user to be the creator
    const adminUser = await prisma.appUser.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'No admin user found to register device');
    }

    device = await prisma.registeredDevice.create({
      data: {
        deviceCode: data.deviceCode,
        friendlyName: data.friendlyName,
        hostname: data.hostname,
        launcherVersion: data.launcherVersion,
        launcherApiKeyHash: hash,
        status: 'ONLINE',
        lastSeenAt: new Date(),
        createdBy: adminUser.id,
      },
    });

    await logWhatsAppAudit({
      deviceId: device.id,
      action: 'DEVICE_REGISTERED',
      metadata: { deviceCode: data.deviceCode, hostname: data.hostname },
    });

    return {
      deviceId: device.id,
      deviceCode: device.deviceCode,
      apiKey: rawKey,
      reRegistered: false,
    };
  }

  /**
   * Process launcher heartbeat.
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
      status: 'ok',
      deviceCode: updated.deviceCode,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Get pending launch commands for a device.
   * The launcher polls this to know when to start/open sessions.
   */
  async getPendingCommands(deviceId: string) {
    // Find sessions assigned to this device that need launching
    const pendingSessions = await prisma.whatsappSession.findMany({
      where: {
        deviceId,
        status: { in: ['LINKING', 'SETUP_REQUIRED'] },
      },
      include: {
        phoneNumber: { select: { e164Number: true } },
      },
    });

    return pendingSessions.map(s => ({
      sessionId: s.id,
      sessionCode: s.sessionCode,
      phoneE164: s.phoneNumber.e164Number,
      sessionDirectory: s.sessionDirectory,
      targetUrl: 'https://web.whatsapp.com',
      action: s.status === 'SETUP_REQUIRED' ? 'setup' : 'open',
    }));
  }
}

export const launcherService = new LauncherService();
