import { Request } from 'express';
import prisma from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

/**
 * Audit logging helper.
 * Records an event to the audit_logs table.
 * Non-blocking — errors are logged to console but don't throw.
 */
export async function logAuditEvent(params: {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  req?: Request;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ?? {},
        ipAddress: params.req?.ip ?? params.req?.socket?.remoteAddress ?? null,
        userAgent: params.req?.headers['user-agent'] ?? null,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    if (process.env.NODE_ENV !== 'test') {
      console.error('Audit log error:', err);
    }
  }
}

/**
 * WhatsApp-specific audit logging.
 * Records to whatsapp_audit_logs table.
 */
export async function logWhatsAppAudit(params: {
  whatsappSessionId?: string;
  deviceId?: string;
  action: string;
  actorUserId?: string;
  metadata?: Prisma.InputJsonValue;
  req?: Request;
}): Promise<void> {
  try {
    await prisma.whatsappAuditLog.create({
      data: {
        whatsappSessionId: params.whatsappSessionId,
        deviceId: params.deviceId,
        action: params.action,
        actorUserId: params.actorUserId,
        metadata: params.metadata ?? {},
        ipAddress: params.req?.ip ?? params.req?.socket?.remoteAddress ?? null,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('WhatsApp audit log error:', err);
    }
  }
}
