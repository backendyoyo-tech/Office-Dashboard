import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, UnauthorizedError } from '@/types/errors';
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
   * Resolve the administrator to attribute a newly-registered device to
   * (REPAIR: D-024).
   *
   * Previously the code did `findFirst({ role: 'ADMIN' })`, which silently
   * picked an arbitrary admin (wrong attribution when several exist) and threw
   * an opaque 500 when none existed. The rules are now deterministic:
   *
   *  1. If the request carried an authenticated ADMIN JWT, that user is the
   *     creator (the dashboard-initiated path).
   *  2. Else, if `LAUNCHER_ENROLLMENT_ADMIN_EMAIL` is configured, that user is
   *     the creator (the unattended first-boot path).
   *  3. Else, require that EXACTLY ONE active ADMIN exists so attribution is
   *     unambiguous; otherwise fail with a clear, actionable error.
   */
  private async resolveDeviceOwner(actorAdminId?: string | null): Promise<string> {
    if (actorAdminId) {
      const actor = await prisma.appUser.findFirst({
        where: { id: actorAdminId, role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      if (!actor) {
        throw new UnauthorizedError(ErrorCode.DEVICE_ENROLLMENT_REQUIRED, 'Enrolling user is not an active ADMIN');
      }
      return actor.id;
    }

    const configuredEmail = process.env.LAUNCHER_ENROLLMENT_ADMIN_EMAIL;
    if (configuredEmail) {
      const configured = await prisma.appUser.findUnique({
        where: { email: configuredEmail.toLowerCase() },
        select: { id: true, role: true, status: true },
      });
      if (!configured || configured.role !== 'ADMIN' || configured.status !== 'ACTIVE') {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          `LAUNCHER_ENROLLMENT_ADMIN_EMAIL (${configuredEmail}) does not match an active ADMIN user`,
        );
      }
      return configured.id;
    }

    const admins = await prisma.appUser.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
      take: 2,
    });

    if (admins.length === 0) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 'No active admin user found to register device');
    }
    if (admins.length > 1) {
      throw new AppError(
        ErrorCode.DEVICE_ENROLLMENT_REQUIRED,
        'Multiple active ADMIN users exist, so device ownership is ambiguous. ' +
          'Register the device from the dashboard with an ADMIN session, or set LAUNCHER_ENROLLMENT_ADMIN_EMAIL.',
      );
    }
    return admins[0].id;
  }

  /**
   * Verify the enrolment credential for first-time / re-registration
   * (REPAIR: D-024 — device registration is no longer anonymous).
   *
   * Accepted proofs, in order:
   *  - a valid `X-Enrollment-Key` matching `LAUNCHER_ENROLLMENT_KEY`, or
   *  - an authenticated ADMIN JWT attached by `optionalAdminAuth`, or
   *  - for RE-registration only, the device's own currently-valid API key.
   */
  verifyEnrollment(params: {
    enrollmentKey?: string | null;
    actorAdminId?: string | null;
    existingApiKey?: string | null;
    existingApiKeyHash?: string | null;
    isReRegistration: boolean;
  }): void {
    const { enrollmentKey, actorAdminId, existingApiKey, existingApiKeyHash, isReRegistration } = params;

    if (actorAdminId) return;

    const configured = process.env.LAUNCHER_ENROLLMENT_KEY;
    if (configured && enrollmentKey) {
      const provided = crypto.createHash('sha256').update(String(enrollmentKey)).digest();
      const expected = crypto.createHash('sha256').update(String(configured)).digest();
      if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) return;
    }

    if (isReRegistration && existingApiKey && existingApiKeyHash) {
      const presentedHash = crypto.createHash('sha256').update(String(existingApiKey)).digest('hex');
      if (presentedHash === existingApiKeyHash) return;
    }

    throw new UnauthorizedError(
      ErrorCode.DEVICE_ENROLLMENT_REQUIRED,
      'First-time device registration requires an ADMIN session or a valid X-Enrollment-Key. ' +
        (isReRegistration
          ? "Re-registration requires the device's current API key, the enrolment key, or an ADMIN session."
          : ''),
    );
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
  }, auth: { actorAdminId?: string | null; enrollmentKey?: string | null; presentedApiKey?: string | null } = {}) {
    // Check if device already exists
    let device = await prisma.registeredDevice.findUnique({
      where: { deviceCode: data.deviceCode },
    });

    // REPAIR D-024 — registration must be authorised (never anonymous).
    this.verifyEnrollment({
      enrollmentKey: auth.enrollmentKey,
      actorAdminId: auth.actorAdminId,
      existingApiKey: auth.presentedApiKey,
      existingApiKeyHash: device?.launcherApiKeyHash ?? null,
      isReRegistration: !!device,
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

    // REPAIR D-024 — deterministic creator attribution (never findFirst).
    const ownerId = await this.resolveDeviceOwner(auth.actorAdminId);

    device = await prisma.registeredDevice.create({
      data: {
        deviceCode: data.deviceCode,
        friendlyName: data.friendlyName,
        hostname: data.hostname,
        launcherVersion: data.launcherVersion,
        launcherApiKeyHash: hash,
        status: 'ONLINE',
        lastSeenAt: new Date(),
        createdBy: ownerId,
      },
    });

    await logWhatsAppAudit({
      deviceId: device.id,
      action: 'DEVICE_REGISTERED',
      metadata: { deviceCode: data.deviceCode, hostname: data.hostname, createdBy: ownerId },
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
      type: 'launch-whatsapp',
      data: {
        session_id: s.id,
        session_code: s.sessionCode,
        session_directory: s.sessionDirectory,
        target_url: 'https://web.whatsapp.com',
        phone_e164: s.phoneNumber.e164Number,
        action: s.status === 'SETUP_REQUIRED' ? 'setup' : 'open',
      },
    }));
  }
}

export const launcherService = new LauncherService();
