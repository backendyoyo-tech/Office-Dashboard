import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError, ForbiddenError } from '@/types/errors';
import { logAuditEvent, logWhatsAppAudit } from '@/middleware/audit';
import { Request } from 'express';
import { updateWithVersion } from '@/lib/concurrency';
import { assertDeviceLaunchable, effectiveDeviceStatus } from '@/lib/device-state';
import { mapWaSessionSummary } from '@/modules/phone-numbers/phone-numbers.service';

const SESSION_DIR_BASE = process.env.WHATSAPP_SESSIONS_BASE_PATH || 'C:\\HairRap\\WhatsAppSessions';

  /**
   * REPAIR D-031 (defense-in-depth documentation).
   *
   * The base session directory is configured through the environment variable
   * `WHATSAPP_SESSIONS_BASE_PATH`. When that variable is absent the default
   * below is used, which matches the legacy launcher convention. The default is
   * documented here so a future operator can change it in `.env` rather than
   * editing source. The directory is *not* created by the server; the launcher
   * is responsible for creating the per-session directory on the machine that
   * runs the browser (spec §6 + D-027).
   */

/**
 * Device-scoped session directory (REPAIR: D-027).
 *
 * Spec §6 requires the session *code* to be preserved when a session moves to a
 * different PC, but the browser user-data directory must live on the PC that
 * actually runs the browser. The original implementation kept one path and just
 * changed the device FK, so the new PC pointed at a directory that only existed
 * on the old PC.
 *
 * Canonical format:
 *     <BASE>\<DEVICE_CODE>\<SESSION_CODE>
 * e.g. C:\HairRap\WhatsAppSessions\PC-01\HR-WA-0001
 *
 * Device code is validated defensively so it can never inject path segments
 * (the launcher rejects anything outside `^[A-Za-z0-9_-]{1,20}$`).
 */
const DEVICE_CODE_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;

export function buildSessionDirectory(deviceCode: string, sessionCode: string): string {
  if (!DEVICE_CODE_PATTERN.test(deviceCode)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Unsafe device code: ${deviceCode}`);
  }
  if (!/^HR-WA-\d{4,}$/.test(sessionCode)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Unsafe session code: ${sessionCode}`);
  }
  // Collapse any run of separators (the configured base path is frequently
  // over-escaped in .env files) and join with exactly one backslash, so the
  // persisted directory can never contain doubled separators.
  const normalizedBase = SESSION_DIR_BASE.replace(/[\\/]+/g, '\\').replace(/\\+$/, '');
  return `${normalizedBase}\\${deviceCode}\\${sessionCode}`;
}

/**
 * WhatsApp Sessions service — Phase 2 session lifecycle management.
 */
export class WhatsAppService {
  /**
   * Generate next session code in HR-WA-XXXX format.
   */
  private async generateSessionCode(): Promise<string> {
    const lastSession = await prisma.whatsappSession.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { sessionCode: true },
    });

    let nextNumber = 1;
    if (lastSession) {
      const match = lastSession.sessionCode.match(/HR-WA-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `HR-WA-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * REPAIR D-023 — authorisation for WhatsApp session mutations.
   *
   * Canonical rule (Phase 2 contract §2 + D-023: "Any EDITOR can setup/open any
   * phone's WhatsApp session" must not be possible):
   *  - ADMIN  : may operate any session.
   *  - EDITOR : may operate a session only if
   *               • they created it, or
   *               • they registered the device the session is assigned to.
   *             There is deliberately NO "admin-owned sessions are shared"
   *             escape hatch: that exception was tried and it voided the
   *             control (a foreign EDITOR could act on every seeded session).
   *  - VIEWER : read-only; every mutation route already requires requireEditor.
   *
   * The check runs server-side on every mutating WhatsApp service entry point;
   * role checks in the router alone are not sufficient.
   */
  private async assertSessionAccess(session: { id: string; createdBy: string; deviceId: string }, req: Request) {
    const user = req.user!;
    if (user.role === 'ADMIN') return;

    if (session.createdBy === user.id) return;

    const device = await prisma.registeredDevice.findUnique({
      where: { id: session.deviceId },
      select: { createdBy: true },
    });
    if (device && device.createdBy === user.id) return;

    throw new ForbiddenError(
      ErrorCode.FORBIDDEN,
      'You do not have permission to manage this WhatsApp session. Only ADMIN, the session creator, or the owner of the assigned device may change it.',
    );
  }

  /**
   * Get the WhatsApp session for a phone number.
   */
  async getByPhoneNumber(phoneNumberId: string) {
    const phone = await prisma.phoneNumber.findUnique({
      where: { id: phoneNumberId },
    });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }

    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
      include: {
        device: {
          select: {
            id: true,
            deviceCode: true,
            friendlyName: true,
            status: true,
            hostname: true,
            launcherVersion: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found for this phone number');
    }

    // REPAIR D-008 — one canonical projection shared with the phone endpoints,
    // so createdBy / updatedAt / deviceId can never be missing again.
    return mapWaSessionSummary(session);
  }

  /**
   * Get a WhatsApp session by its UUID (used by launcher).
   */
  async getBySessionId(sessionId: string) {
    const session = await prisma.whatsappSession.findUnique({
      where: { id: sessionId },
      include: {
        phoneNumber: { select: { id: true, e164Number: true } },
      },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }
    return session;
  }

  /**
   * Create a WhatsApp session mapping for a phone number.
   */
  async create(phoneNumberId: string, data: { deviceId: string }, req: Request) {
    const phone = await prisma.phoneNumber.findUnique({
      where: { id: phoneNumberId },
    });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }
    if (phone.archivedAt !== null) {
      throw new AppError(ErrorCode.PHONE_ARCHIVED, 'Cannot create WhatsApp session for archived phone number');
    }

    // Check if session already exists
    const existing = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.WA_SESSION_EXISTS, 'This phone number already has a WhatsApp session');
    }

    // Verify device exists and is enabled
    const device = await prisma.registeredDevice.findUnique({
      where: { id: data.deviceId },
    });
    if (!device) {
      throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    }
    if (!device.enabled) {
      throw new AppError(ErrorCode.DEVICE_DISABLED, 'Device has been disabled');
    }

    const sessionCode = await this.generateSessionCode();
    // REPAIR D-027 — directory is device-scoped so the path is valid on the PC
    // that actually owns the session.
    const sessionDirectory = buildSessionDirectory(device.deviceCode, sessionCode);

    const session = await prisma.whatsappSession.create({
      data: {
        sessionCode,
        phoneNumberId,
        deviceId: data.deviceId,
        status: 'SETUP_REQUIRED',
        sessionDirectory,
        createdBy: req.user!.id,
      },
      include: {
        device: {
          select: {
            id: true, deviceCode: true, friendlyName: true, status: true,
            hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
          },
        },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'WA_SESSION_CREATED',
      entityType: 'WHATSAPP_SESSION',
      entityId: session.id,
      metadata: { sessionCode, phoneNumberId, deviceId: data.deviceId },
      req,
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      deviceId: data.deviceId,
      action: 'WA_SESSION_CREATED',
      actorUserId: req.user!.id,
      metadata: { sessionCode, phoneNumberId },
    });

    return mapWaSessionSummary(session);
  }

  /**
   * Update a WhatsApp session (change device, status).
   */
  async update(phoneNumberId: string, data: { deviceId?: string; status?: string; version?: number }, req: Request) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found for this phone number');
    }

    // REPAIR D-023 — ownership/authorisation is enforced server-side.
    await this.assertSessionAccess(session, req);

    const updateData: any = {};
    let deviceChanged = false;
    let previousDirectory: string | null = null;

    if (data.deviceId && data.deviceId !== session.deviceId) {
      const device = await prisma.registeredDevice.findUnique({
        where: { id: data.deviceId },
      });
      if (!device) throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
      if (!device.enabled) throw new AppError(ErrorCode.DEVICE_DISABLED, 'Device has been disabled');

      deviceChanged = true;
      previousDirectory = session.sessionDirectory;

      updateData.deviceId = data.deviceId;
      updateData.status = 'SETUP_REQUIRED'; // New device requires re-setup
      // REPAIR D-027 — the session code is preserved but the browser profile
      // directory is rebuilt on the NEW device. The old PC's directory is left
      // untouched (and is never reused by the new PC).
      updateData.sessionDirectory = buildSessionDirectory(device.deviceCode, session.sessionCode);
      updateData.linkedAt = null;
      updateData.lastOpenedAt = null;
      updateData.lastError = null;
    }

    if (data.status) {
      updateData.status = data.status;
    }

    // REPAIR D-006 — version-checked write.
    const updated = await updateWithVersion({
      model: 'whatsappSession',
      id: session.id,
      expectedVersion: data.version,
      data: updateData,
      include: {
        device: {
          select: {
            id: true, deviceCode: true, friendlyName: true, status: true,
            hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
          },
        },
      },
    });

    if (deviceChanged) {
      await logWhatsAppAudit({
        whatsappSessionId: session.id,
        deviceId: data.deviceId!,
        action: 'WA_SESSION_DEVICE_CHANGED',
        actorUserId: req.user!.id,
        metadata: {
          oldDeviceId: session.deviceId,
          newDeviceId: data.deviceId,
          oldSessionDirectory: previousDirectory,
          newSessionDirectory: updated.sessionDirectory,
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        action: 'WA_SESSION_DEVICE_CHANGED',
        entityType: 'WHATSAPP_SESSION',
        entityId: session.id,
        metadata: {
          oldDeviceId: session.deviceId,
          newDeviceId: data.deviceId,
          oldSessionDirectory: previousDirectory,
          newSessionDirectory: updated.sessionDirectory,
        },
        req,
      });
    }

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'WA_SESSION_UPDATED',
      entityType: 'WHATSAPP_SESSION',
      entityId: session.id,
      metadata: { changes: { status: data.status, deviceChanged }, previousVersion: session.version, newVersion: updated.version },
      req,
    });

    return mapWaSessionSummary(updated);
  }

  /**
   * Disable/archive a WhatsApp session.
   */
  async disable(phoneNumberId: string, req: Request) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }

    // REPAIR D-023 — ownership check.
    await this.assertSessionAccess(session, req);

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: { status: 'DISABLED' },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'WA_SESSION_DISABLED',
      entityType: 'WHATSAPP_SESSION',
      entityId: session.id,
      req,
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      deviceId: session.deviceId,
      action: 'WA_SESSION_DISABLED',
      actorUserId: req.user!.id,
    });

    return mapWaSessionSummary(updated);
  }

  /**
   * Request launcher to start/setup a new session.
   */
  async setup(phoneNumberId: string, req: Request) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
      include: { device: true, phoneNumber: true },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }

    // REPAIR D-023 — authorisation runs FIRST, before any state or device
    // detail, so an unauthorised caller cannot probe the session (they get 403
    // regardless of the session's current status).
    await this.assertSessionAccess(session, req);

    // Validate state transition
    const validStates = ['SETUP_REQUIRED', 'ERROR', 'RELOGIN_REQUIRED'];
    if (!validStates.includes(session.status)) {
      throw new AppError(ErrorCode.WA_SESSION_INVALID_STATE, `Cannot setup session in ${session.status} state`);
    }

    // REPAIR D-023 — ownership check (before any state/precondition detail, so
    // an unauthorised caller cannot probe session state).

    /**
     * REPAIR D-007 / D-021 — device availability.
     * A device whose status is UNKNOWN has simply not heartbeated yet; it is
     * still allowed to receive a launch command. OFFLINE (stale heartbeat) and
     * DISABLED hard-block. The launcher must still authenticate with its own API
     * key before anything executes, so this does not weaken security.
     */
    assertDeviceLaunchable(session.device);

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: { status: 'LINKING', lastError: null },
      include: {
        device: {
          select: {
            id: true, deviceCode: true, friendlyName: true, status: true,
            hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
          },
        },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'WA_SESSION_SETUP_REQUESTED',
      entityType: 'WHATSAPP_SESSION',
      entityId: session.id,
      metadata: { deviceId: session.deviceId },
      req,
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      deviceId: session.deviceId,
      action: 'WA_SESSION_SETUP_REQUESTED',
      actorUserId: req.user!.id,
    });

    return {
      session: mapWaSessionSummary(updated),
      launchCommand: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        phoneE164: session.phoneNumber.e164Number,
        sessionDirectory: updated.sessionDirectory,
        targetUrl: 'https://web.whatsapp.com',
      },
    };
  }

  /**
   * Request launcher to open an existing linked session.
   */
  async open(phoneNumberId: string, req: Request) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
      include: { device: true, phoneNumber: true },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }

    // REPAIR D-023 — authorisation runs FIRST, before any device/state detail,
    // so an unauthorised caller cannot probe the session (they get 403
    // regardless of the session's current status).
    await this.assertSessionAccess(session, req);

    if (session.status !== 'LINKED') {
      throw new AppError(ErrorCode.WA_SESSION_INVALID_STATE, `Cannot open session in ${session.status} state. Session must be LINKED.`);
    }

    // REPAIR D-023 — ownership check (before any device/state detail, so an
    // unauthorised caller cannot probe the session).

    /**
     * REPAIR D-007 / D-021 — the original check was `status !== 'ONLINE'`, which
     * rejected every device that had not yet sent a heartbeat. The canonical
     * rule now distinguishes:
     *   DISABLED → blocked,  OFFLINE (stale heartbeat) → blocked,
     *   UNKNOWN (no heartbeat yet) → allowed, ONLINE → allowed.
     * The launcher still has to authenticate before executing the command.
     */
    assertDeviceLaunchable(session.device);

    // Transition to LINKING so the launcher picks up the command
    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: { status: 'LINKING', lastOpenedAt: new Date() },
      include: {
        device: {
          select: {
            id: true, deviceCode: true, friendlyName: true, status: true,
            hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
          },
        },
      },
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      deviceId: session.deviceId,
      action: 'WA_SESSION_OPEN_REQUESTED',
      actorUserId: req.user!.id,
      metadata: { deviceEffectiveStatus: effectiveDeviceStatus(session.device) },
    });

    return {
      session: mapWaSessionSummary(updated),
      launchCommand: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        phoneE164: session.phoneNumber.e164Number,
        sessionDirectory: session.sessionDirectory,
        targetUrl: 'https://web.whatsapp.com',
      },
    };
  }

  /**
   * Request re-linking (reconnect) for a session.
   */
  async reconnect(phoneNumberId: string, req: Request) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
      include: { device: true, phoneNumber: true },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }

    // REPAIR D-023 — authorisation runs FIRST, before any state detail.
    await this.assertSessionAccess(session, req);

    const validStates = ['LINKED', 'LINKING', 'RELOGIN_REQUIRED', 'ERROR'];
    if (!validStates.includes(session.status)) {
      throw new AppError(ErrorCode.WA_SESSION_INVALID_STATE, `Cannot reconnect session in ${session.status} state`);
    }

    // REPAIR D-023 — ownership check (before any state detail).

    // REPAIR D-007 / D-021 — canonical device availability (UNKNOWN allowed).
    assertDeviceLaunchable(session.device);

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: { status: 'LINKING', lastError: null },
      include: {
        device: {
          select: {
            id: true, deviceCode: true, friendlyName: true, status: true,
            hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
          },
        },
      },
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      deviceId: session.deviceId,
      action: 'WA_SESSION_LINKING',
      actorUserId: req.user!.id,
      metadata: { reason: 'reconnect', deviceEffectiveStatus: effectiveDeviceStatus(session.device) },
    });

    return {
      session: mapWaSessionSummary(updated),
      launchCommand: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        phoneE164: session.phoneNumber.e164Number,
        sessionDirectory: session.sessionDirectory,
        targetUrl: 'https://web.whatsapp.com',
      },
    };
  }

  /**
   * Launcher confirms QR link success/failure.
   */
  async confirmLink(phoneNumberId: string, data: {
    sessionCode: string;
    success: boolean;
    error?: string;
  }, device?: any) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }

    // Validate session code matches
    if (session.sessionCode !== data.sessionCode) {
      throw new AppError(ErrorCode.WA_INVALID_SESSION_ID, 'Session code mismatch');
    }

    // Validate device assignment (skip for dashboard-initiated calls where device not set)
    if (device && session.deviceId !== device.id) {
      throw new AppError(ErrorCode.WA_DEVICE_MISMATCH, 'Session is not assigned to this device');
    }

    if (data.success) {
      const updated = await prisma.whatsappSession.update({
        where: { phoneNumberId },
        data: {
          status: 'LINKED',
          linkedAt: new Date(),
          lastError: null,
        },
        include: {
          device: {
            select: {
              id: true, deviceCode: true, friendlyName: true, status: true,
              hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
            },
          },
        },
      });

      // REPAIR D-034 — launcher events record the responsible device so the
      // audit trail is never "null actor, null device".
      await logWhatsAppAudit({
        whatsappSessionId: session.id,
        deviceId: device?.id ?? session.deviceId,
        action: 'WA_SESSION_LINKED',
        metadata: { confirmedVia: 'launcher', deviceCode: device?.deviceCode ?? null },
      });

      return mapWaSessionSummary(updated);
    } else {
      const updated = await prisma.whatsappSession.update({
        where: { phoneNumberId },
        data: {
          status: 'RELOGIN_REQUIRED',
          lastError: data.error || 'Link failed',
        },
        include: {
          device: {
            select: {
              id: true, deviceCode: true, friendlyName: true, status: true,
              hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
            },
          },
        },
      });

      // REPAIR D-034 — include the device that reported the failure.
      await logWhatsAppAudit({
        whatsappSessionId: session.id,
        deviceId: device?.id ?? session.deviceId,
        action: 'WA_SESSION_LINK_FAILED',
        metadata: { error: data.error, confirmedVia: 'launcher' },
      });

      return mapWaSessionSummary(updated);
    }
  }

  /**
   * Launcher reports status change.
   */
  async statusUpdate(phoneNumberId: string, data: {
    sessionCode: string;
    status: string;
    error?: string;
  }, device?: any) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }

    if (session.sessionCode !== data.sessionCode) {
      throw new AppError(ErrorCode.WA_INVALID_SESSION_ID, 'Session code mismatch');
    }

    // Validate device assignment (skip for dashboard-initiated calls where device not set)
    if (device && session.deviceId !== device.id) {
      throw new AppError(ErrorCode.WA_DEVICE_MISMATCH, 'Session is not assigned to this device');
    }

    const updateData: any = { status: data.status };
    if (data.error) updateData.lastError = data.error;
    if (data.status === 'LINKED') updateData.linkedAt = new Date();

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: updateData,
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      // REPAIR D-034 — the device is the actor for launcher-driven events.
      deviceId: device?.id ?? session.deviceId,
      action: `WA_SESSION_${data.status}`,
      metadata: { error: data.error, reportedVia: device ? 'launcher' : 'dashboard', deviceCode: device?.deviceCode ?? null },
    });

    return mapWaSessionSummary(updated);
  }

  /**
   * Launcher confirms browser launch success/failure (distinct from QR link confirmation).
   * On success the session stays in LINKING state (browser opened, QR not yet scanned).
   * On failure the session transitions to ERROR.
   */
  async browserLaunchConfirmed(
    phoneNumberId: string,
    success: boolean,
    error?: string,
    device?: any,
  ) {
    if (success) {
      const updated = await prisma.whatsappSession.update({
        where: { phoneNumberId },
        data: { lastOpenedAt: new Date() },
        include: {
          device: {
            select: {
              id: true, deviceCode: true, friendlyName: true, status: true,
              hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
            },
          },
        },
      });

      // REPAIR D-034 — device is recorded as the acting party.
      await logWhatsAppAudit({
        whatsappSessionId: updated.id,
        deviceId: device?.id ?? updated.deviceId,
        action: 'WA_BROWSER_LAUNCHED',
        metadata: { deviceCode: device?.deviceCode ?? null },
      });

      return mapWaSessionSummary(updated);
    } else {
      const updated = await prisma.whatsappSession.update({
        where: { phoneNumberId },
        data: { status: 'ERROR', lastError: error || 'Browser launch failed' },
        include: {
          device: {
            select: {
              id: true, deviceCode: true, friendlyName: true, status: true,
              hostname: true, launcherVersion: true, lastSeenAt: true, enabled: true,
            },
          },
        },
      });

      // REPAIR D-034 — device is recorded as the acting party.
      await logWhatsAppAudit({
        whatsappSessionId: updated.id,
        deviceId: device?.id ?? updated.deviceId,
        action: 'WA_BROWSER_LAUNCH_FAILED',
        metadata: { error: error || 'Browser launch failed', deviceCode: device?.deviceCode ?? null },
      });

      return mapWaSessionSummary(updated);
    }
  }
}

export const whatsappService = new WhatsAppService();

