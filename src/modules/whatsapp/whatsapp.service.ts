import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent, logWhatsAppAudit } from '@/middleware/audit';
import { Request } from 'express';

const SESSION_DIR_BASE = process.env.WHATSAPP_SESSIONS_BASE_PATH || 'C:\\HairRap\\WhatsAppSessions';

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

    return {
      id: session.id,
      sessionCode: session.sessionCode,
      phoneNumberId: session.phoneNumberId,
      deviceId: session.deviceId,
      status: session.status,
      sessionDirectory: session.sessionDirectory,
      linkedAt: session.linkedAt,
      lastOpenedAt: session.lastOpenedAt,
      lastError: session.lastError,
      device: session.device,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
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
    if (phone.status === 'ARCHIVED') {
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
    const sessionDirectory = `${SESSION_DIR_BASE}\\${sessionCode}`;

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
        device: { select: { deviceCode: true, friendlyName: true, status: true } },
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

    return session;
  }

  /**
   * Update a WhatsApp session (change device, status).
   */
  async update(phoneNumberId: string, data: { deviceId?: string; status?: string }, req: Request) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found for this phone number');
    }

    const updateData: any = {};

    if (data.deviceId && data.deviceId !== session.deviceId) {
      const device = await prisma.registeredDevice.findUnique({
        where: { id: data.deviceId },
      });
      if (!device) throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
      if (!device.enabled) throw new AppError(ErrorCode.DEVICE_DISABLED, 'Device has been disabled');

      updateData.deviceId = data.deviceId;
      updateData.status = 'SETUP_REQUIRED'; // New device requires re-setup
      updateData.linkedAt = null;
      updateData.lastOpenedAt = null;
      updateData.lastError = null;
    }

    if (data.status) {
      updateData.status = data.status;
    }

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: updateData,
      include: {
        device: { select: { id: true, deviceCode: true, friendlyName: true, status: true } },
      },
    });

    if (data.deviceId && data.deviceId !== session.deviceId) {
      await logWhatsAppAudit({
        whatsappSessionId: session.id,
        deviceId: data.deviceId,
        action: 'WA_SESSION_DEVICE_CHANGED',
        actorUserId: req.user!.id,
        metadata: { oldDeviceId: session.deviceId, newDeviceId: data.deviceId },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        action: 'WA_SESSION_DEVICE_CHANGED',
        entityType: 'WHATSAPP_SESSION',
        entityId: session.id,
        metadata: { oldDeviceId: session.deviceId, newDeviceId: data.deviceId },
        req,
      });
    }

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'WA_SESSION_UPDATED',
      entityType: 'WHATSAPP_SESSION',
      entityId: session.id,
      metadata: { changes: data },
      req,
    });

    return updated;
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

    return updated;
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

    // Validate state transition
    const validStates = ['SETUP_REQUIRED', 'ERROR', 'RELOGIN_REQUIRED'];
    if (!validStates.includes(session.status)) {
      throw new AppError(ErrorCode.WA_SESSION_INVALID_STATE, `Cannot setup session in ${session.status} state`);
    }

    if (!session.device.enabled) {
      throw new AppError(ErrorCode.DEVICE_DISABLED, 'Assigned device is disabled');
    }

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: { status: 'LINKING', lastError: null },
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
      session: updated,
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

    if (session.status !== 'LINKED') {
      throw new AppError(ErrorCode.WA_SESSION_INVALID_STATE, `Cannot open session in ${session.status} state. Session must be LINKED.`);
    }

    if (!session.device.enabled) {
      throw new AppError(ErrorCode.DEVICE_DISABLED, 'Assigned device is disabled');
    }

    if (session.device.status !== 'ONLINE') {
      throw new AppError(ErrorCode.DEVICE_OFFLINE, 'Assigned device is offline');
    }

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: { lastOpenedAt: new Date() },
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      deviceId: session.deviceId,
      action: 'WA_SESSION_OPENED',
      actorUserId: req.user!.id,
    });

    return {
      session: updated,
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

    const validStates = ['LINKED', 'RELOGIN_REQUIRED', 'ERROR'];
    if (!validStates.includes(session.status)) {
      throw new AppError(ErrorCode.WA_SESSION_INVALID_STATE, `Cannot reconnect session in ${session.status} state`);
    }

    if (!session.device.enabled) {
      throw new AppError(ErrorCode.DEVICE_DISABLED, 'Assigned device is disabled');
    }

    const updated = await prisma.whatsappSession.update({
      where: { phoneNumberId },
      data: { status: 'LINKING', lastError: null },
    });

    await logWhatsAppAudit({
      whatsappSessionId: session.id,
      deviceId: session.deviceId,
      action: 'WA_SESSION_LINKING',
      actorUserId: req.user!.id,
      metadata: { reason: 'reconnect' },
    });

    return {
      session: updated,
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
  }, device: any) {
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

    // Validate device assignment
    if (session.deviceId !== device.id) {
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
      });

      await logWhatsAppAudit({
        whatsappSessionId: session.id,
        deviceId: device.id,
        action: 'WA_SESSION_LINKED',
      });

      return updated;
    } else {
      const updated = await prisma.whatsappSession.update({
        where: { phoneNumberId },
        data: {
          status: 'RELOGIN_REQUIRED',
          lastError: data.error || 'Link failed',
        },
      });

      await logWhatsAppAudit({
        whatsappSessionId: session.id,
        deviceId: device.id,
        action: 'WA_SESSION_LINK_FAILED',
        metadata: { error: data.error },
      });

      return updated;
    }
  }

  /**
   * Launcher reports status change.
   */
  async statusUpdate(phoneNumberId: string, data: {
    sessionCode: string;
    status: string;
    error?: string;
  }, device: any) {
    const session = await prisma.whatsappSession.findUnique({
      where: { phoneNumberId },
    });
    if (!session) {
      throw new NotFoundError(ErrorCode.WA_SESSION_NOT_FOUND, 'No WhatsApp session found');
    }

    if (session.sessionCode !== data.sessionCode) {
      throw new AppError(ErrorCode.WA_INVALID_SESSION_ID, 'Session code mismatch');
    }

    if (session.deviceId !== device.id) {
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
      deviceId: device.id,
      action: `WA_SESSION_${data.status}`,
      metadata: { error: data.error },
    });

    return updated;
  }
}

export const whatsappService = new WhatsAppService();
