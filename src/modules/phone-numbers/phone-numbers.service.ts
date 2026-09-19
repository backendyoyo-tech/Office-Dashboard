import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';
import { Request } from 'express';
import { parsePhoneNumber } from 'libphonenumber-js';
import type { PaginationInput } from '@/validation/common';

/**
 * Phone Numbers service — CRUD with E.164 normalization.
 */
export class PhoneNumbersService {
  /**
   * Parse and normalize a phone number to E.164 format.
   */
  private normalizeToE164(phoneNumber: string): { e164: string; countryCode: string; nationalNumber: string } {
    const parsed = parsePhoneNumber(phoneNumber);
    if (!parsed || !parsed.isValid()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid phone number');
    }

    const e164 = parsed.number; // Already in E.164 format
    const countryCode = parsed.countryCallingCode;
    const nationalNumber = parsed.nationalNumber;

    return { e164, countryCode, nationalNumber };
  }

  async list(params: PaginationInput & { search?: string; status?: string; sortBy?: string; sortOrder?: string }) {
    const { page, pageSize, search, status, sortBy, sortOrder } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.OR = [
        { e164Number: { contains: search } },
        { label: { contains: search, mode: 'insensitive' } },
        { simProvider: { contains: search, mode: 'insensitive' } },
        { nationalNumber: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const orderBy: any = {};
    const sortField = sortBy ?? 'createdAt';
    orderBy[sortField] = sortOrder ?? 'desc';

    const [data, totalCount] = await Promise.all([
      prisma.phoneNumber.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          creator: { select: { id: true, fullName: true } },
          accountLinks: {
            include: {
              platformAccount: {
                include: { platform: true },
              },
            },
          },
          whatsappSession: {
            select: {
              id: true,
              sessionCode: true,
              status: true,
              device: { select: { deviceCode: true, status: true } },
            },
          },
        },
      }),
      prisma.phoneNumber.count({ where }),
    ]);

    return {
      data: data.map(phone => ({
        id: phone.id,
        e164Number: phone.e164Number,
        countryCode: phone.countryCode,
        nationalNumber: phone.nationalNumber,
        simProvider: phone.simProvider,
        label: phone.label,
        status: phone.status,
        notes: phone.notes,
        createdBy: phone.creator,
        createdAt: phone.createdAt,
        updatedAt: phone.updatedAt,
        archivedAt: phone.archivedAt,
        connectedAccounts: phone.accountLinks.map(link => ({
          linkId: link.id,
          accountId: link.platformAccountId,
          platform: link.platformAccount.platform.displayName,
          platformSlug: link.platformAccount.platform.slug,
          displayName: link.platformAccount.displayName,
          accountHandle: link.platformAccount.accountHandle,
          relationshipType: link.relationshipType,
          isPrimary: link.isPrimary,
        })),
        whatsappSession: phone.whatsappSession ? {
          id: phone.whatsappSession.id,
          sessionCode: phone.whatsappSession.sessionCode,
          status: phone.whatsappSession.status,
          device: phone.whatsappSession.device,
        } : null,
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
    const phone = await prisma.phoneNumber.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, fullName: true } },
        updater: { select: { id: true, fullName: true } },
        accountLinks: {
          include: {
            platformAccount: {
              include: { platform: true, credential: true, recoveryMethods: true },
            },
            linker: { select: { id: true, fullName: true } },
          },
        },
        whatsappSession: {
          include: {
            device: { select: { id: true, deviceCode: true, friendlyName: true, status: true } },
          },
        },
      },
    });

    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }

    return {
      id: phone.id,
      e164Number: phone.e164Number,
      countryCode: phone.countryCode,
      nationalNumber: phone.nationalNumber,
      simProvider: phone.simProvider,
      label: phone.label,
      status: phone.status,
      notes: phone.notes,
      createdBy: phone.creator,
      updatedBy: phone.updater,
      createdAt: phone.createdAt,
      updatedAt: phone.updatedAt,
      archivedAt: phone.archivedAt,
      connectedAccounts: phone.accountLinks.map(link => ({
        linkId: link.id,
        accountId: link.platformAccountId,
        platform: link.platformAccount.platform.displayName,
        platformSlug: link.platformAccount.platform.slug,
        displayName: link.platformAccount.displayName,
        accountHandle: link.platformAccount.accountHandle,
        loginIdentifier: link.platformAccount.loginIdentifier,
        profileUrl: link.platformAccount.profileUrl,
        externalAccountId: link.platformAccount.externalAccountId,
        accountStatus: link.platformAccount.accountStatus,
        notes: link.platformAccount.notes,
        relationshipType: link.relationshipType,
        isPrimary: link.isPrimary,
        linkedBy: link.linker,
        linkedAt: link.linkedAt,
        hasCredentials: !!link.platformAccount.credential,
        recoveryMethods: link.platformAccount.recoveryMethods.map(rm => ({
          id: rm.id,
          methodType: rm.methodType,
          valueNormalized: rm.valueNormalized,
          isPrimary: rm.isPrimary,
        })),
      })),
      whatsappSession: phone.whatsappSession ? {
        id: phone.whatsappSession.id,
        sessionCode: phone.whatsappSession.sessionCode,
        status: phone.whatsappSession.status,
        sessionDirectory: phone.whatsappSession.sessionDirectory,
        linkedAt: phone.whatsappSession.linkedAt,
        lastOpenedAt: phone.whatsappSession.lastOpenedAt,
        lastError: phone.whatsappSession.lastError,
        device: phone.whatsappSession.device ? {
          id: phone.whatsappSession.device.id,
          deviceCode: phone.whatsappSession.device.deviceCode,
          friendlyName: phone.whatsappSession.device.friendlyName,
          status: phone.whatsappSession.device.status,
        } : null,
        createdAt: phone.whatsappSession.createdAt,
      } : null,
    };
  }

  async create(data: {
    phoneNumber: string;
    label?: string;
    simProvider?: string;
    notes?: string;
  }, req: Request) {
    const { e164, countryCode, nationalNumber } = this.normalizeToE164(data.phoneNumber);

    // Check for duplicate
    const existing = await prisma.phoneNumber.findUnique({
      where: { e164Number: e164 },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.PHONE_DUPLICATE, 'This phone number already exists');
    }

    const phone = await prisma.phoneNumber.create({
      data: {
        e164Number: e164,
        countryCode,
        nationalNumber,
        simProvider: data.simProvider,
        label: data.label,
        notes: data.notes,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_CREATED',
      entityType: 'PHONE_NUMBER',
      entityId: phone.id,
      metadata: { e164Number: phone.e164Number },
      req,
    });

    return phone;
  }

  async update(id: string, data: {
    label?: string;
    simProvider?: string;
    notes?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }, req: Request) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }
    if (phone.status === 'ARCHIVED') {
      throw new AppError(ErrorCode.PHONE_ARCHIVED, 'Cannot update an archived phone number');
    }

    const updated = await prisma.phoneNumber.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.simProvider !== undefined && { simProvider: data.simProvider }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
        updatedBy: req.user!.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_UPDATED',
      entityType: 'PHONE_NUMBER',
      entityId: id,
      metadata: { changes: data },
      req,
    });

    return updated;
  }

  async archive(id: string, req: Request) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }
    if (phone.status === 'ARCHIVED') {
      throw new ConflictError(ErrorCode.PHONE_ARCHIVED, 'Phone number is already archived');
    }

    const archived = await prisma.phoneNumber.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedBy: req.user!.id,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_ARCHIVED',
      entityType: 'PHONE_NUMBER',
      entityId: id,
      req,
    });

    return archived;
  }

  async restore(id: string, req: Request) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }
    if (phone.status !== 'ARCHIVED') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Phone number is not archived');
    }

    const restored = await prisma.phoneNumber.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        archivedAt: null,
        updatedBy: req.user!.id,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_RESTORED',
      entityType: 'PHONE_NUMBER',
      entityId: id,
      req,
    });

    return restored;
  }
}

export const phoneNumbersService = new PhoneNumbersService();
