import prisma from '@/lib/db/prisma';
import { encryptCredential, decryptCredential } from '@/lib/crypto/encryption';
import { AppError, ErrorCode, NotFoundError } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';
import { Request } from 'express';

/**
 * Credentials service — encrypted credential management.
 * Uses AES-256-GCM with platform_account_id as AAD.
 */
export class CredentialsService {
  async setCredential(
    platformAccountId: string,
    password: string,
    req: Request,
  ) {
    const acct = await prisma.platformAccount.findUnique({
      where: { id: platformAccountId },
    });
    if (!acct) {
      throw new NotFoundError(ErrorCode.ACCOUNT_NOT_FOUND, 'Platform account not found');
    }

    // Encrypt using platform_account_id as AAD
    const encrypted = encryptCredential(password, platformAccountId);

    const credential = await prisma.accountCredential.upsert({
      where: { platformAccountId },
      create: {
        platformAccountId,
        passwordCiphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
        secretUpdatedBy: req.user!.id,
        secretUpdatedAt: new Date(),
      },
      update: {
        passwordCiphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
        secretUpdatedBy: req.user!.id,
        secretUpdatedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'CREDENTIAL_SET',
      entityType: 'CREDENTIAL',
      entityId: credential.id,
      metadata: { platformAccountId },
      req,
    });

    return {
      id: credential.id,
      keyVersion: credential.keyVersion,
      secretUpdatedAt: credential.secretUpdatedAt,
    };
  }

  async replaceCredential(
    platformAccountId: string,
    newPassword: string,
    req: Request,
  ) {
    return this.setCredential(platformAccountId, newPassword, req);
  }

  /**
   * Reveal credential plaintext.
   * MUST be audit-logged and MUST set Cache-Control: no-store.
   */
  async revealCredential(
    platformAccountId: string,
    req: Request,
  ) {
    const credential = await prisma.accountCredential.findUnique({
      where: { platformAccountId },
    });
    if (!credential) {
      throw new NotFoundError(ErrorCode.CREDENTIAL_NOT_FOUND, 'No credentials found for this account');
    }

    let plaintext: string;
    try {
      plaintext = decryptCredential(
        {
          ciphertext: credential.passwordCiphertext,
          nonce: credential.nonce,
          authTag: credential.authTag ?? '',
          keyVersion: credential.keyVersion,
        },
        platformAccountId,
      );
    } catch {
      throw new AppError(ErrorCode.CREDENTIAL_DECRYPT_ERROR, 'Failed to decrypt credential');
    }

    await logAuditEvent({
      actorUserId: req.user!.id,
      action: 'CREDENTIAL_REVEALED',
      entityType: 'CREDENTIAL',
      entityId: credential.id,
      metadata: { platformAccountId },
      req,
    });

    return {
      password: plaintext,
      keyVersion: credential.keyVersion,
      secretUpdatedAt: credential.secretUpdatedAt,
    };
  }

  async getCredentialStatus(platformAccountId: string) {
    const credential = await prisma.accountCredential.findUnique({
      where: { platformAccountId },
      select: {
        id: true,
        keyVersion: true,
        secretUpdatedAt: true,
        createdAt: true,
      },
    });

    if (!credential) {
      return null;
    }

    return {
      id: credential.id,
      keyVersion: credential.keyVersion,
      secretUpdatedAt: credential.secretUpdatedAt,
      createdAt: credential.createdAt,
    };
  }
}

export const credentialsService = new CredentialsService();
