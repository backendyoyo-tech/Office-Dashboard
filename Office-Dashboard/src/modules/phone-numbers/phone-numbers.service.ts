import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';
import { Request } from 'express';
import { parsePhoneNumber } from 'libphonenumber-js';
import type { PaginationInput } from '@/validation/common';
import { updateWithVersion } from '@/lib/concurrency';
import { evaluatePhoneCompleteness, linkToCompletenessInput, type CompletenessState } from '@/lib/completeness';
import { sanitizeOptionalText } from '@/lib/sanitize';

/**
 * Upper bound on rows scanned when filtering by the *derived* completeness
 * value. Completeness depends on joined account data so it cannot be expressed
 * as a single indexed predicate; we bound the scan and document the limit.
 */
export const PHONE_COMPLETENESS_SCAN_LIMIT: number = 5000;

/**
 * Canonical phone-number summary projection (REPAIR: D-004, D-006, D-011, D-012).
 * This is the single place that shapes a phone number for the API, so the list
 * and detail endpoints can never drift apart again.
 */
export function mapPhoneSummary(phone: any) {
  // REPAIR D-004 — completeness is derived from the stored fields of the linked
  // accounts. A phone with no links is EMPTY (onboarding), not "incomplete".
  const derived = evaluatePhoneCompleteness(
    (phone.accountLinks ?? []).map(linkToCompletenessInput),
  );

  return {
    id: phone.id,
    e164Number: phone.e164Number,
    countryCode: phone.countryCode,
    nationalNumber: phone.nationalNumber,
    simProvider: phone.simProvider,
    label: phone.label,
    status: phone.status,
    notes: phone.notes,
    createdBy: phone.creator ?? null,
    // REPAIR D-011 — the updater is now part of the list contract.
    updatedBy: phone.updater ?? null,
    createdAt: phone.createdAt,
    updatedAt: phone.updatedAt,
    // REPAIR D-006 — optimistic-locking token.
    version: phone.version,
    archivedAt: phone.archivedAt,
    // REPAIR D-004 — derived completeness contract.
    completeness: derived.state,
    completeAccounts: derived.completeAccounts,
    totalAccounts: derived.totalAccounts,
    // REPAIR D-012 — canonical field name is `accountLinks` everywhere.
    accountLinks: (phone.accountLinks ?? []).map((link: any) => ({
      id: link.id,
      phoneNumberId: link.phoneNumberId,
      platformAccountId: link.platformAccountId,
      relationshipType: link.relationshipType,
      isPrimary: link.isPrimary,
      linkedBy: link.linker ? { id: link.linker.id, fullName: link.linker.fullName } : null,
      linkedAt: link.linkedAt,
      platformAccount: fullPlatformAccount(link.platformAccount),
    })),
    // Explicit count alias (kept for older frontend builds that read `connectedAccounts`).
    connectedAccounts: (phone.accountLinks ?? []).length,
    whatsappSession: phone.whatsappSession ? mapWaSessionSummary(phone.whatsappSession) : null,
  };
}

/** Canonical WhatsApp session projection (REPAIR: D-008). */
export function mapWaSessionSummary(session: any) {
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
    // REPAIR D-008 — fields the frontend WhatsAppSession type requires.
    createdBy: session.createdBy,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    version: session.version,
    device: session.device ? {
      id: session.device.id,
      deviceCode: session.device.deviceCode,
      friendlyName: session.device.friendlyName,
      status: session.device.status,
      hostname: session.device.hostname ?? null,
      launcherVersion: session.device.launcherVersion ?? null,
      lastSeenAt: session.device.lastSeenAt ?? null,
      enabled: session.device.enabled ?? true,
    } : null,
  };
}

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

  async list(params: PaginationInput & { search?: string; status?: string; whatsappStatus?: string; completeness?: CompletenessState; sortBy?: string; sortOrder?: string }) {
    const { page, pageSize, search, status, whatsappStatus, completeness: completenessFilter, sortBy, sortOrder } = params;
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
    if (whatsappStatus) {
      where.whatsappSession = { status: whatsappStatus as any };
    }

    const orderBy: any = {};
    const sortField = sortBy ?? 'createdAt';
    orderBy[sortField] = sortOrder ?? 'desc';

    const [rows, unfilteredCount] = await Promise.all([
      prisma.phoneNumber.findMany({
        where,
        orderBy,
        // When filtering on the derived `completeness` value we must scan the
        // filtered set and paginate in memory (bounded by PHONE_COMPLETENESS_SCAN_LIMIT).
        ...(completenessFilter ? { take: PHONE_COMPLETENESS_SCAN_LIMIT } : { skip, take: pageSize }),
        include: {
          creator: { select: { id: true, fullName: true } },
          // REPAIR D-011 — the list endpoint must expose the updater, not just the creator.
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
            select: {
              id: true,
              sessionCode: true,
              phoneNumberId: true,
              deviceId: true,
              status: true,
              sessionDirectory: true,
              linkedAt: true,
              lastOpenedAt: true,
              lastError: true,
              createdBy: true,
              createdAt: true,
              updatedAt: true,
              version: true,
              device: { select: { id: true, deviceCode: true, friendlyName: true, status: true } },
            },
          },
        },
      }),
      completenessFilter ? Promise.resolve(0) : prisma.phoneNumber.count({ where }),
    ]);

    const mapped = rows.map(mapPhoneSummary);
    const filtered = completenessFilter ? mapped.filter(p => p.completeness === completenessFilter) : mapped;
    const totalCount = completenessFilter ? filtered.length : unfilteredCount;
    const data = completenessFilter ? filtered.slice(skip, skip + pageSize) : mapped;

    return {
      data,
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

    return mapPhoneSummary(phone);
  }

  async create(data: {
    e164Number: string;
    countryCode?: string;
    nationalNumber?: string;
    label?: string;
    simProvider?: string;
    notes?: string;
  }, req: Request) {
    // Normalize the E.164 number
    const { e164, countryCode, nationalNumber } = this.normalizeToE164(data.e164Number);

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
        simProvider: sanitizeOptionalText(data.simProvider, 80),
        label: sanitizeOptionalText(data.label, 120),
        notes: sanitizeOptionalText(data.notes, 2000),
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
        updater: { select: { id: true, fullName: true } },
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

    return mapPhoneSummary(phone);
  }

  async update(id: string, data: {
    label?: string;
    simProvider?: string;
    notes?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    version?: number;
  }, req: Request) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }
    if (phone.archivedAt !== null) {
      throw new AppError(ErrorCode.PHONE_ARCHIVED, 'Cannot update an archived phone number');
    }

    // REPAIR D-006 — version-checked write (409 CONCURRENCY_CONFLICT on stale).
    const updated = await updateWithVersion({
      model: 'phoneNumber',
      id,
      expectedVersion: data.version,
      data: {
        ...(data.label !== undefined && { label: sanitizeOptionalText(data.label, 120) ?? null }),
        ...(data.simProvider !== undefined && { simProvider: sanitizeOptionalText(data.simProvider, 80) ?? null }),
        ...(data.notes !== undefined && { notes: sanitizeOptionalText(data.notes, 2000) ?? null }),
        ...(data.status !== undefined && { status: data.status }),
        updatedBy: req.user!.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
        updater: { select: { id: true, fullName: true } },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_UPDATED',
      entityType: 'PHONE_NUMBER',
      entityId: id,
      metadata: { changes: data, previousVersion: phone.version, newVersion: updated.version },
      req,
    });

    return mapPhoneSummary(updated);
  }

  async archive(id: string, req: Request, expectedVersion?: number) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }
    if (phone.archivedAt !== null) {
      throw new ConflictError(ErrorCode.PHONE_ARCHIVED, 'Phone number is already archived');
    }

    // REPAIR D-006 — version-checked archive.
    const archived = await updateWithVersion({
      model: 'phoneNumber',
      id,
      expectedVersion,
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedBy: req.user!.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
        updater: { select: { id: true, fullName: true } },
      },
    });

    // REPAIR D-026 — archiving releases the WhatsApp session from the device.
    await prisma.whatsappSession.updateMany({
      where: { phoneNumberId: id, status: { not: 'DISABLED' } },
      data: { status: 'DISABLED' },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_ARCHIVED',
      entityType: 'PHONE_NUMBER',
      entityId: id,
      metadata: { previousVersion: phone.version, newVersion: archived.version },
      req,
    });

    return mapPhoneSummary(archived);
  }

  async restore(id: string, req: Request, expectedVersion?: number) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }
    if (phone.archivedAt === null) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Phone number is not archived');
    }

    // REPAIR D-006 — version-checked restore.
    const restored = await updateWithVersion({
      model: 'phoneNumber',
      id,
      expectedVersion,
      data: {
        status: 'ACTIVE',
        archivedAt: null,
        updatedBy: req.user!.id,
      },
      include: {
        creator: { select: { id: true, fullName: true } },
        updater: { select: { id: true, fullName: true } },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_RESTORED',
      entityType: 'PHONE_NUMBER',
      entityId: id,
      metadata: { previousVersion: phone.version, newVersion: restored.version },
      req,
    });

    return mapPhoneSummary(restored);
  }

  /**
   * List all platform accounts linked to a phone number.
   * Returns PhoneAccountLink-shaped objects matching the frontend type.
   */
  async listAccounts(phoneId: string) {
    const phone = await prisma.phoneNumber.findUnique({
      where: { id: phoneId },
      include: {
        accountLinks: {
          include: {
            platformAccount: {
              include: { platform: true, credential: true, recoveryMethods: true },
            },
            linker: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }

    return phone.accountLinks.map(link => ({
      id: link.id,
      phoneNumberId: link.phoneNumberId,
      platformAccountId: link.platformAccountId,
      relationshipType: link.relationshipType,
      isPrimary: link.isPrimary,
      linkedBy: link.linker ? { id: link.linker.id, fullName: link.linker.fullName } : null,
      linkedAt: link.linkedAt,
      platformAccount: fullPlatformAccount(link.platformAccount),
    }));
  }

  /**
   * Link a platform account to this phone number.
   */
  async linkAccount(phoneId: string, data: { platformAccountId: string; relationshipType: string; isPrimary: boolean }, req: Request) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneId } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }

    const account = await prisma.platformAccount.findUnique({ where: { id: data.platformAccountId } });
    if (!account) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }

    const existing = await prisma.phoneAccountLink.findFirst({
      where: {
        phoneNumberId: phoneId,
        platformAccountId: data.platformAccountId,
        relationshipType: data.relationshipType as any,
      },
    });
    if (existing) {
      throw new ConflictError(ErrorCode.DUPLICATE_ENTRY, 'This phone number is already linked to this account with this relationship type');
    }

    const link = await prisma.phoneAccountLink.create({
      data: {
        phoneNumberId: phoneId,
        platformAccountId: data.platformAccountId,
        relationshipType: data.relationshipType as any,
        isPrimary: data.isPrimary,
        linkedBy: req.user!.id,
      },
      include: {
        platformAccount: {
          include: { platform: true, credential: true, recoveryMethods: true },
        },
        linker: { select: { id: true, fullName: true } },
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_ACCOUNT_LINKED',
      entityType: 'PHONE_ACCOUNT_LINK',
      entityId: link.id,
      metadata: { phoneNumberId: phoneId, platformAccountId: data.platformAccountId, relationshipType: data.relationshipType },
      req,
    });

    return {
      id: link.id,
      phoneNumberId: link.phoneNumberId,
      platformAccountId: link.platformAccountId,
      relationshipType: link.relationshipType,
      isPrimary: link.isPrimary,
      linkedBy: link.linker ? { id: link.linker.id, fullName: link.linker.fullName } : null,
      linkedAt: link.linkedAt,
      platformAccount: fullPlatformAccount(link.platformAccount),
    };
  }

  /**
   * Unlink a platform account from this phone number.
   */
  async unlinkAccount(phoneId: string, linkId: string, req: Request) {
    const link = await prisma.phoneAccountLink.findFirst({
      where: { id: linkId, phoneNumberId: phoneId },
    });
    if (!link) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, 'Phone-account link not found');
    }

    await prisma.phoneAccountLink.delete({ where: { id: linkId } });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'PHONE_ACCOUNT_UNLINKED',
      entityType: 'PHONE_ACCOUNT_LINK',
      entityId: linkId,
      metadata: { phoneNumberId: phoneId },
      req,
    });

    return { success: true };
  }
}

/**
 * Transform a raw Prisma PlatformAccount into the frontend PlatformAccount summary shape.
 * Used in phone number list/detail context where we only need account summary info.
 */
function phoneAccountSummary(acct: any) {
  return {
    id: acct.id,
    platform: { id: acct.platform.id, slug: acct.platform.slug, displayName: acct.platform.displayName, iconKey: acct.platform.iconKey, isActive: acct.platform.isActive },
    displayName: acct.displayName,
    accountHandle: acct.accountHandle,
    accountStatus: acct.accountStatus,
    hasCredential: !!acct.credential,
  };
}

/**
 * Transform a raw Prisma PlatformAccount (with full includes) into the frontend PlatformAccount shape.
 */
function fullPlatformAccount(acct: any) {
  return {
    id: acct.id,
    platformId: acct.platformId,
    displayName: acct.displayName,
    accountHandle: acct.accountHandle,
    loginIdentifier: acct.loginIdentifier,
    profileUrl: acct.profileUrl,
    externalAccountId: acct.externalAccountId,
    accountStatus: acct.accountStatus,
    notes: acct.notes,
    createdBy: acct.createdBy,
    updatedBy: acct.updatedBy,
    createdAt: acct.createdAt,
    updatedAt: acct.updatedAt,
    archivedAt: acct.archivedAt,
    platform: acct.platform ? { id: acct.platform.id, slug: acct.platform.slug, displayName: acct.platform.displayName, iconKey: acct.platform.iconKey, isActive: acct.platform.isActive } : null,
    credential: acct.credential ? {
      id: acct.credential.id,
      keyVersion: acct.credential.keyVersion,
      secretUpdatedAt: acct.credential.secretUpdatedAt,
      createdAt: acct.credential.createdAt,
      hasCredential: true,
    } : null,
    recoveryMethods: (acct.recoveryMethods || []).map((rm: any) => ({
      id: rm.id,
      methodType: rm.methodType,
      valueNormalized: rm.valueNormalized,
      isPrimary: rm.isPrimary,
      createdAt: rm.createdAt,
      updatedAt: rm.updatedAt,
    })),
  };
}

export const phoneNumbersService = new PhoneNumbersService();
