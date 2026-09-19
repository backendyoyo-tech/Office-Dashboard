import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';
import { Request } from 'express';
import type { PaginationInput } from '@/validation/common';

/**
 * Platform Accounts service — CRUD with platform linking.
 */
export class PlatformAccountsService {
  async list(params: PaginationInput & {
    search?: string;
    platformId?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { page, pageSize, search, platformId, status, sortBy, sortOrder } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { accountHandle: { contains: search, mode: 'insensitive' } },
        { loginIdentifier: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (platformId) where.platformId = platformId;
    if (status) where.accountStatus = status;
    // Exclude archived by default
    where.archivedAt = null;

    const orderBy: any = {};
    orderBy[sortBy ?? 'createdAt'] = sortOrder ?? 'desc';

    const [data, totalCount] = await Promise.all([
      prisma.platformAccount.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          platform: true,
          accountLinks: {
            include: {
              phoneNumber: { select: { id: true, e164Number: true, label: true } },
            },
          },
          credential: { select: { id: true, keyVersion: true, secretUpdatedAt: true } },
        },
      }),
      prisma.platformAccount.count({ where }),
    ]);

    return {
      data: data.map(acct => ({
        id: acct.id,
        platform: { id: acct.platform.id, slug: acct.platform.slug, displayName: acct.platform.displayName },
        displayName: acct.displayName,
        accountHandle: acct.accountHandle,
        loginIdentifier: acct.loginIdentifier,
        profileUrl: acct.profileUrl,
        externalAccountId: acct.externalAccountId,
        accountStatus: acct.accountStatus,
        notes: acct.notes,
        linkedPhones: acct.accountLinks.map(link => ({
          phoneNumber: link.phoneNumber,
          relationshipType: link.relationshipType,
          isPrimary: link.isPrimary,
        })),
        hasCredentials: !!acct.credential,
        createdAt: acct.createdAt,
        updatedAt: acct.updatedAt,
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
    const acct = await prisma.platformAccount.findUnique({
      where: { id },
      include: {
        platform: true,
        accountLinks: {
          include: {
            phoneNumber: true,
            linker: { select: { id: true, fullName: true } },
          },
        },
        credential: true,
        recoveryMethods: true,
      },
    });

    if (!acct) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }

    return {
      id: acct.id,
      platform: { id: acct.platform.id, slug: acct.platform.slug, displayName: acct.platform.displayName },
      displayName: acct.displayName,
      accountHandle: acct.accountHandle,
      loginIdentifier: acct.loginIdentifier,
      profileUrl: acct.profileUrl,
      externalAccountId: acct.externalAccountId,
      accountStatus: acct.accountStatus,
      notes: acct.notes,
      linkedPhones: acct.accountLinks.map(link => ({
        linkId: link.id,
        phoneNumber: {
          id: link.phoneNumber.id,
          e164Number: link.phoneNumber.e164Number,
          label: link.phoneNumber.label,
        },
        relationshipType: link.relationshipType,
        isPrimary: link.isPrimary,
        linkedBy: link.linker,
        linkedAt: link.linkedAt,
      })),
      hasCredentials: !!acct.credential,
      recoveryMethods: acct.recoveryMethods.map(rm => ({
        id: rm.id,
        methodType: rm.methodType,
        valueNormalized: rm.valueNormalized,
        isPrimary: rm.isPrimary,
      })),
      createdAt: acct.createdAt,
      updatedAt: acct.updatedAt,
    };
  }

  async create(data: {
    platformId: number;
    displayName?: string;
    accountHandle?: string;
    loginIdentifier?: string;
    profileUrl?: string;
    externalAccountId?: string;
    accountStatus?: string;
    notes?: string;
  }, req: Request) {
    // Verify platform exists
    const platform = await prisma.platform.findUnique({ where: { id: data.platformId } });
    if (!platform) {
      throw new NotFoundError(ErrorCode.PLATFORM_NOT_FOUND, 'Platform not found');
    }

    const acct = await prisma.platformAccount.create({
      data: {
        platformId: data.platformId,
        displayName: data.displayName,
        accountHandle: data.accountHandle,
        loginIdentifier: data.loginIdentifier,
        profileUrl: data.profileUrl || null,
        externalAccountId: data.externalAccountId,
        accountStatus: (data.accountStatus as any) ?? 'UNKNOWN',
        notes: data.notes,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      },
      include: { platform: true },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'ACCOUNT_CREATED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: acct.id,
      metadata: { platform: platform.slug, displayName: acct.displayName },
      req,
    });

    return acct;
  }

  async update(id: string, data: Record<string, any>, req: Request) {
    const acct = await prisma.platformAccount.findUnique({ where: { id } });
    if (!acct) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }

    const updated = await prisma.platformAccount.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.accountHandle !== undefined && { accountHandle: data.accountHandle }),
        ...(data.loginIdentifier !== undefined && { loginIdentifier: data.loginIdentifier }),
        ...(data.profileUrl !== undefined && { profileUrl: data.profileUrl || null }),
        ...(data.externalAccountId !== undefined && { externalAccountId: data.externalAccountId }),
        ...(data.accountStatus !== undefined && { accountStatus: data.accountStatus }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedBy: req.user!.id,
      },
      include: { platform: true },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'ACCOUNT_UPDATED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: id,
      metadata: { changes: data },
      req,
    });

    return updated;
  }

  async linkPhone(accountId: string, phoneNumberId: string, relationshipType: string, isPrimary: boolean, req: Request) {
    const acct = await prisma.platformAccount.findUnique({ where: { id: accountId } });
    if (!acct) throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');

    const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
    if (!phone) throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');

    // Check for existing link
    const existing = await prisma.phoneAccountLink.findFirst({
      where: {
        phoneNumberId,
        platformAccountId: accountId,
        relationshipType: relationshipType as any,
      },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.DUPLICATE_ENTRY, 'This phone number is already linked to this account with this relationship type');
    }

    const link = await prisma.phoneAccountLink.create({
      data: {
        phoneNumberId,
        platformAccountId: accountId,
        relationshipType: relationshipType as any,
        isPrimary,
        linkedBy: req.user!.id,
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_ACCOUNT_LINKED',
      entityType: 'PHONE_ACCOUNT_LINK',
      entityId: link.id,
      metadata: { phoneNumberId, platformAccountId: accountId, relationshipType },
      req,
    });

    return link;
  }

  async unlinkPhone(accountId: string, phoneNumberId: string, req: Request) {
    const link = await prisma.phoneAccountLink.findFirst({
      where: { phoneNumberId, platformAccountId: accountId },
    });
    if (!link) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, 'Phone-account link not found');
    }

    await prisma.phoneAccountLink.delete({ where: { id: link.id } });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_ACCOUNT_UNLINKED',
      entityType: 'PHONE_ACCOUNT_LINK',
      entityId: link.id,
      metadata: { phoneNumberId, platformAccountId: accountId },
      req,
    });

    return { success: true };
  }

  async archive(id: string, req: Request) {
    const acct = await prisma.platformAccount.findUnique({ where: { id } });
    if (!acct) throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    if (acct.archivedAt) throw new ConflictError(ErrorCode.ACCOUNT_ALREADY_ARCHIVED, 'Account is already archived');

    const archived = await prisma.platformAccount.update({
      where: { id },
      data: { archivedAt: new Date(), updatedBy: req.user!.id },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'ACCOUNT_ARCHIVED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: id,
      req,
    });

    return archived;
  }

  async getPlatforms() {
    return prisma.platform.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });
  }
}

export const platformAccountsService = new PlatformAccountsService();
