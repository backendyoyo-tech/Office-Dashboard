import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';

/**
 * Auth service — login, token generation/rotation, password change.
 *
 * REPAIRS
 *  - SEC-002: account lockout after repeated failed logins.
 *  - SEC-003: refresh-token rotation (the refresh token is stored only as a
 *    SHA-256 hash, single-use, and rotated on every use).
 */

/** Failed attempts allowed before the account is locked. */
export const AUTH_MAX_FAILED_ATTEMPTS = (() => {
  const raw = process.env.AUTH_MAX_FAILED_ATTEMPTS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
})();

/** Lockout duration in milliseconds (default 15 minutes). */
export const AUTH_LOCKOUT_MS = (() => {
  const raw = process.env.AUTH_LOCKOUT_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60 * 1000;
})();

/** Refresh-token lifetime in milliseconds (default 7 days). */
export const AUTH_REFRESH_TTL_MS = (() => {
  const raw = process.env.AUTH_REFRESH_TTL_HOURS;
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
})();

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Auth service — login, token generation, password change.
 */
export class AuthService {
  async login(email: string, password: string, req: Request) {
    const user = await prisma.appUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Generic error to prevent user enumeration
    if (!user || !user.passwordHash) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    if (user.status === 'DISABLED') {
      throw new AppError(ErrorCode.ACCOUNT_DISABLED, 'Account has been disabled');
    }

    // REPAIR SEC-002 — refuse while the lockout window is active.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const seconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      await logAuditEvent({
        actorUserId: user.id,
        action: 'USER_LOGIN_LOCKED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { retryAfterSeconds: seconds },
        req,
      });
      throw new AppError(
        ErrorCode.ACCOUNT_LOCKED,
        `Account temporarily locked after ${AUTH_MAX_FAILED_ATTEMPTS} failed login attempts. Try again in ${seconds}s.`,
      );
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      // REPAIR SEC-002 — count the failure and lock when the threshold is hit.
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= AUTH_MAX_FAILED_ATTEMPTS;

      await prisma.appUser.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + AUTH_LOCKOUT_MS) : null,
        },
      });

      await logAuditEvent({
        actorUserId: user.id,
        action: shouldLock ? 'USER_LOGIN_LOCKED' : 'USER_LOGIN_FAILED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { failedAttempts: attempts, threshold: AUTH_MAX_FAILED_ATTEMPTS },
        req,
      });

      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Successful login clears the failure counter and issues a token pair.
    const tokens = this.issueTokens(user.id);
    const now = new Date();

    const updated = await prisma.appUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        refreshTokenHash: tokens.refreshTokenHash,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
    });

    await logAuditEvent({
      actorUserId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      req,
    });

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        lastLoginAt: now,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    };
  }

  /** Mint an access token plus a single-use refresh token (hash stored). */
  private issueTokens(userId: string) {
    const accessToken = this.generateToken(userId);
    const refreshToken = `hr_rt_${crypto.randomBytes(48).toString('hex')}`;
    return {
      accessToken,
      refreshToken,
      refreshTokenHash: hashRefreshToken(refreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + AUTH_REFRESH_TTL_MS),
      expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
    };
  }

  generateToken(userId: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET not set');

    const expiresIn = process.env.JWT_EXPIRES_IN ?? '24h';
    return jwt.sign({ userId }, jwtSecret, { expiresIn: expiresIn as any });
  }

  async getProfile(userId: string) {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, req: Request) {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect');
    }

    const newHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.appUser.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await logAuditEvent({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId,
      req,
    });

    return { success: true };
  }
}

export const authService = new AuthService();
