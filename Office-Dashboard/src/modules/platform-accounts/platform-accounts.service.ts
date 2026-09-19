import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, NotFoundError, ConflictError } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';
import { Request } from 'express';
import type { PaginationInput } from '@/validation/common';
import { updateWithVersion } from '@/lib/concurrency';
import { sanitizeOptionalText, sanitizeUrl, isCleanText } from '@/lib/sanitize';
import { encryptCredential } from '@/lib/crypto/encryption';

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
              linker: { select: { id: true, fullName: true } },
            },
          },
          credential: { select: { id: true, keyVersion: true, secretUpdatedAt: true, createdAt: true } },
          recoveryMethods: true,
        },
      }),
      prisma.platformAccount.count({ where }),
    ]);

    return {
      data: data.map(acct => transformPlatformAccount(acct)),
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

    return transformPlatformAccount(acct, true);
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
    /** REPAIR D-002 / D-003 — persisted (encrypted) with the account. */
    password?: string;
  }, req: Request) {
    // Verify platform exists
    const platform = await prisma.platform.findUnique({ where: { id: data.platformId } });
    if (!platform) {
      throw new NotFoundError(ErrorCode.PLATFORM_NOT_FOUND, 'Platform not found');
    }

    // REPAIR D-018 — defence in depth: re-validate the URL in the service layer
    // (never rely on the transport schema alone).
    const profileUrl = normalizeProfileUrl(data.profileUrl);

    // REPAIR D-017 — never persist markup, even if the schema was bypassed.
    assertCleanFields(data);

    /**
     * REPAIR D-002 / D-003 — the account and its credential are created in a
     * single transaction. Previously the password was silently dropped, so the
     * reveal endpoint returned 404 for every account created through this route.
     */
    const acct = await prisma.$transaction(async tx => {
      const created = await tx.platformAccount.create({
        data: {
          platformId: data.platformId,
          displayName: sanitizeOptionalText(data.displayName, 160) ?? null,
          accountHandle: sanitizeOptionalText(data.accountHandle, 160) ?? null,
          loginIdentifier: sanitizeOptionalText(data.loginIdentifier, 160) ?? null,
          profileUrl,
          externalAccountId: sanitizeOptionalText(data.externalAccountId, 160) ?? null,
          accountStatus: (data.accountStatus as any) ?? 'UNKNOWN',
          notes: sanitizeOptionalText(data.notes, 2000) ?? null,
          createdBy: req.user!.id,
          updatedBy: req.user!.id,
        },
      });

      if (data.password) {
        const encrypted = encryptCredential(data.password, created.id);
        await tx.accountCredential.create({
          data: {
            platformAccountId: created.id,
            passwordCiphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            authTag: encrypted.authTag,
            keyVersion: encrypted.keyVersion,
            secretUpdatedBy: req.user!.id,
            secretUpdatedAt: new Date(),
          },
        });
      }

      return tx.platformAccount.findUniqueOrThrow({
        where: { id: created.id },
        include: { platform: true, credential: true, recoveryMethods: true },
      });
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'ACCOUNT_CREATED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: acct.id,
      metadata: { platform: platform.slug, displayName: acct.displayName, credentialCreated: !!data.password },
      req,
    });

    if (data.password) {
      await logAuditEvent({
        actorUserId: req.user!.id,
        action: 'CREDENTIAL_SET',
        entityType: 'PLATFORM_ACCOUNT',
        entityId: acct.id,
        metadata: { platformAccountId: acct.id, via: 'account-create' },
        req,
      });
    }

    return transformPlatformAccount(acct);
  }

  async update(id: string, data: Record<string, any>, req: Request) {
    const acct = await prisma.platformAccount.findUnique({ where: { id } });
    if (!acct) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }
    if (acct.archivedAt) {
      throw new ConflictError(ErrorCode.ACCOUNT_ALREADY_ARCHIVED, 'Cannot update an archived account');
    }

    const { version: expectedVersion, ...fields } = data;

    // REPAIR D-018 — service-layer URL validation.
    const profileUrl = normalizeProfileUrl(fields.profileUrl, true);

    // REPAIR D-017 — reject markup that bypassed the schema.
    assertCleanFields(fields);

    // REPAIR D-006 — version-checked write.
    const updated = await updateWithVersion({
      model: 'platformAccount',
      id,
      expectedVersion,
      data: {
        ...(fields.displayName !== undefined && { displayName: sanitizeOptionalText(fields.displayName, 160) ?? null }),
        ...(fields.accountHandle !== undefined && { accountHandle: sanitizeOptionalText(fields.accountHandle, 160) ?? null }),
        ...(fields.loginIdentifier !== undefined && { loginIdentifier: sanitizeOptionalText(fields.loginIdentifier, 160) ?? null }),
        ...(profileUrl !== undefined && { profileUrl }),
        ...(fields.externalAccountId !== undefined && { externalAccountId: sanitizeOptionalText(fields.externalAccountId, 160) ?? null }),
        ...(fields.accountStatus !== undefined && { accountStatus: fields.accountStatus }),
        ...(fields.notes !== undefined && { notes: sanitizeOptionalText(fields.notes, 2000) ?? null }),
        updatedBy: req.user!.id,
      },
      include: { platform: true, credential: true, recoveryMethods: true },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'ACCOUNT_UPDATED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: id,
      metadata: { changes: fields, previousVersion: acct.version, newVersion: updated.version },
      req,
    });

    return transformPlatformAccount(updated);
  }

  async linkPhone(accountId: string, phoneNumberId: string, relationshipType: string, isPrimary: boolean, req: Request) {
    const acct = await prisma.platformAccount.findUnique({ where: { id: accountId } });
    if (!acct) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }

    const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
    if (!phone) {
      throw new NotFoundError(ErrorCode.PHONE_NOT_FOUND, 'Phone number not found');
    }

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
      action: 'ACCOUNT_LINKED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: accountId,
      metadata: { phoneNumberId, relationshipType, isPrimary },
      req,
    });

    return link;
  }

  async unlinkPhone(accountId: string, phoneNumberId: string, req: Request) {
    const link = await prisma.phoneAccountLink.findFirst({
      where: { platformAccountId: accountId, phoneNumberId },
    });
    if (!link) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, 'Phone-account link not found');
    }

    await prisma.phoneAccountLink.delete({ where: { id: link.id } });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'ACCOUNT_UNLINKED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: accountId,
      metadata: { phoneNumberId },
      req,
    });

    return { success: true };
  }

  async archive(id: string, req: Request, expectedVersion?: number) {
    const acct = await prisma.platformAccount.findUnique({ where: { id } });
    if (!acct) throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    if (acct.archivedAt) throw new ConflictError(ErrorCode.ACCOUNT_ALREADY_ARCHIVED, 'Account is already archived');

    // REPAIR D-006 — version-checked archive.
    const archived = await updateWithVersion({
      model: 'platformAccount',
      id,
      expectedVersion,
      data: { archivedAt: new Date(), updatedBy: req.user!.id },
      include: { platform: true, credential: true, recoveryMethods: true },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'ACCOUNT_ARCHIVED',
      entityType: 'PLATFORM_ACCOUNT',
      entityId: id,
      metadata: { previousVersion: acct.version, newVersion: archived.version },
      req,
    });

    return transformPlatformAccount(archived);
  }

  async getPlatforms() {
    return prisma.platform.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });
  }
}

/**
 * Service-layer URL policy (REPAIR: D-018).
 * Accepts an absolute http(s) URL or an empty value; rejects everything else.
 *
 * @param keepUndefined — when true, `undefined` stays `undefined` (PATCH
 *        semantics: "field not supplied"); otherwise `undefined` maps to `null`.
 */
function normalizeProfileUrl(value: unknown, keepUndefined = false): string | null | undefined {
  if (value === undefined) return keepUndefined ? undefined : null;
  if (value === null || value === '') return null;
  try {
    return sanitizeUrl(value) ?? null;
  } catch (err: any) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, err?.message ?? 'Invalid profileUrl');
  }
}

/** Reject markup / control characters that would have bypassed the schema. */
function assertCleanFields(fields: Record<string, any>): void {
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value === 'string' && !isCleanText(value)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `${field} contains unsupported characters`);
    }
  }
}

/**
 * Transform a raw Prisma PlatformAccount into the frontend PlatformAccount shape.
 * Excludes sensitive credential fields (passwordCiphertext, nonce, authTag).
 *
 * REPAIR D-013 — the canonical credential contract is the nested object
 * `credential: { …, hasCredential: true } | null`. The old top-level
 * `hasCredentials` boolean (which the frontend type never declared) is gone, so
 * there is exactly one way to ask "does this account have a password?".
 *
 * @param includeLinks — when true (getById), include full accountLinks with phone details
 */
function transformPlatformAccount(acct: any, includeLinks: boolean = false) {
  const result: any = {
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
    // REPAIR D-006 — optimistic-locking token.
    version: acct.version,
    archivedAt: acct.archivedAt,
    platform: acct.platform ? {
      id: acct.platform.id,
      slug: acct.platform.slug,
      displayName: acct.platform.displayName,
      iconKey: acct.platform.iconKey,
      isActive: acct.platform.isActive,
    } : null,
    credential: acct.credential ? {
      id: acct.credential.id,
      platformAccountId: acct.credential.platformAccountId ?? acct.id,
      keyVersion: acct.credential.keyVersion,
      secretUpdatedAt: acct.credential.secretUpdatedAt,
      createdAt: acct.credential.createdAt,
      hasCredential: true,
    } : null,
    recoveryMethods: (acct.recoveryMethods || []).map((rm: any) => ({
      id: rm.id,
      platformAccountId: rm.platformAccountId ?? acct.id,
      methodType: rm.methodType,
      valueNormalized: rm.valueNormalized,
      isPrimary: rm.isPrimary,
      createdBy: rm.createdBy,
      createdAt: rm.createdAt,
      updatedAt: rm.updatedAt,
    })),
  };

  if (includeLinks && acct.accountLinks) {
    result.accountLinks = acct.accountLinks.map((link: any) => ({
      id: link.id,
      phoneNumberId: link.phoneNumberId,
      platformAccountId: link.platformAccountId,
      relationshipType: link.relationshipType,
      isPrimary: link.isPrimary,
      linkedBy: link.linker ? { id: link.linker.id, fullName: link.linker.fullName } : null,
      linkedAt: link.linkedAt,
      phoneNumber: link.phoneNumber ? {
        id: link.phoneNumber.id,
        e164Number: link.phoneNumber.e164Number,
        label: link.phoneNumber.label,
        status: link.phoneNumber.status,
      } : null,
    }));
  }

  return result;
}

export const platformAccountsService = new PlatformAccountsService();
