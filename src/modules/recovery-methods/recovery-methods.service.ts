import prisma from '@/lib/db/prisma';
import { NotFoundError, ErrorCode, ConflictError, AppError } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';
import { Request } from 'express';

/**
 * Recovery Methods service — recovery email/phone CRUD.
 */
export class RecoveryMethodsService {
  async listByAccount(platformAccountId: string) {
    const acct = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId },
    });
    if (!acct) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }

    const methods = await prisma.accountRecoveryMethod.findMany({
      where: { platformAccountId },
      orderBy: { isPrimary: 'desc' },
    });

    return methods;
  }

  async create(data: {
    platformAccountId: string;
    methodType: 'EMAIL' | 'PHONE';
    value: string;
    isPrimary?: boolean;
  }, req: Request) {
    const acct = await prisma.platformAccount.findUnique({
      where: { id: data.platformAccountId },
    });
    if (!acct) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }

    // Normalize the value
    let valueNormalized = data.value.trim().toLowerCase();
    if (data.methodType === 'PHONE') {
      // Basic E.164 normalization for phone
      valueNormalized = data.value.replace(/[\s\-()]/g, '');
      if (!valueNormalized.startsWith('+')) {
        valueNormalized = '+' + valueNormalized;
      }
    }

    // Check for duplicate
    const existing = await prisma.accountRecoveryMethod.findFirst({
      where: {
        platformAccountId: data.platformAccountId,
        methodType: data.methodType,
        valueNormalized,
      },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.DUPLICATE_ENTRY, 'This recovery method already exists for this account');
    }

    // If setting as primary, unset existing primary of same type
    if (data.isPrimary) {
      await prisma.accountRecoveryMethod.updateMany({
        where: {
          platformAccountId: data.platformAccountId,
          methodType: data.methodType,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const method = await prisma.accountRecoveryMethod.create({
      data: {
        platformAccountId: data.platformAccountId,
        methodType: data.methodType,
        valueNormalized,
        isPrimary: data.isPrimary ?? false,
        createdBy: req.user!.id,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'RECOVERY_METHOD_CREATED',
      entityType: 'RECOVERY_METHOD',
      entityId: method.id,
      metadata: { platformAccountId: data.platformAccountId, methodType: data.methodType },
      req,
    });

    return method;
  }

  async update(id: string, data: { isPrimary?: boolean }, req: Request) {
    const method = await prisma.accountRecoveryMethod.findUnique({
      where: { id },
    });
    if (!method) {
      throw new NotFoundError(ErrorCode.RECOVERY_METHOD_NOT_FOUND, 'Recovery method not found');
    }

    if (data.isPrimary) {
      await prisma.accountRecoveryMethod.updateMany({
        where: {
          platformAccountId: method.platformAccountId,
          methodType: method.methodType,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.accountRecoveryMethod.update({
      where: { id },
      data: {
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'RECOVERY_METHOD_UPDATED',
      entityType: 'RECOVERY_METHOD',
      entityId: id,
      metadata: { changes: data },
      req,
    });

    return updated;
  }

  async delete(id: string, req: Request) {
    const method = await prisma.accountRecoveryMethod.findUnique({
      where: { id },
    });
    if (!method) {
      throw new NotFoundError(ErrorCode.RECOVERY_METHOD_NOT_FOUND, 'Recovery method not found');
    }

    await prisma.accountRecoveryMethod.delete({ where: { id } });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'RECOVERY_METHOD_DELETED',
      entityType: 'RECOVERY_METHOD',
      entityId: id,
      req,
    });

    return { success: true };
  }
}

export const recoveryMethodsService = new RecoveryMethodsService();
