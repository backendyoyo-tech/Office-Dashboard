import argon2 from 'argon2';
import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { AUTH_LOCKOUT_MS, AUTH_MAX_FAILED_ATTEMPTS } from '@/modules/auth/auth.service';
import { requireActivePhoneAccountLink } from '@/lib/association';
import { assertApprovedPlatformDevice } from '@/lib/platform-device';
import { AppError, ErrorCode, ForbiddenError } from '@/types/errors';

export type PlatformLaunchOperation = 'SETUP' | 'OPEN' | 'RECONNECT';

/** Server-side, one-use password step-up. No grant is issued on a public route without local device proof. */
export class LaunchGrantService {
  async createForPlatform(input: {
    actorUserId: string; phoneNumberId: string; platformAccountId: string;
    deviceId: string; operation: PlatformLaunchOperation; password: string;
  }) {
    const user = await prisma.appUser.findUnique({ where: { id: input.actorUserId } });
    if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'EDITOR'].includes(user.role) || !user.passwordHash || !user.refreshTokenHash) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Launch reauthentication is unavailable');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(ErrorCode.ACCOUNT_LOCKED, 'Account is temporarily locked');
    }
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.appUser.update({ where: { id: user.id }, data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= AUTH_MAX_FAILED_ATTEMPTS ? new Date(Date.now() + AUTH_LOCKOUT_MS) : null,
      } });
      await prisma.auditLog.create({ data: {
        actorUserId: user.id, action: 'LAUNCH_CHALLENGE_FAILED', entityType: 'USER', entityId: user.id,
        metadata: { reason: 'PASSWORD_REJECTED' },
      } });
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Reauthentication failed');
    }
    await prisma.appUser.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    await requireActivePhoneAccountLink(input.phoneNumberId, input.platformAccountId);
    const device = await prisma.registeredDevice.findUnique({ where: { id: input.deviceId } });
    if (!device) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Device is not approved for account launch');
    assertApprovedPlatformDevice(device);

    const secret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    const expiresAt = new Date(Date.now() + 4 * 60 * 1000);
    const grant = await prisma.launchGrant.create({ data: {
      secretHash, actorUserId: user.id, authSessionHash: user.refreshTokenHash,
      userVersion: user.version, deviceId: input.deviceId,
      phoneNumberId: input.phoneNumberId, platformAccountId: input.platformAccountId,
      operation: input.operation, expiresAt,
    } });
    await prisma.auditLog.create({ data: {
      actorUserId: user.id, action: 'LAUNCH_GRANT_ISSUED', entityType: 'PLATFORM_ACCOUNT',
      entityId: input.platformAccountId,
      metadata: { deviceId: input.deviceId, phoneNumberId: input.phoneNumberId, operation: input.operation },
    } });
    return { grantId: grant.id, grantSecret: secret, expiresAt };
  }
}

export const launchGrantService = new LaunchGrantService();
