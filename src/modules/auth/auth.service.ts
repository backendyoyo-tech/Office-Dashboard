import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode } from '@/types/errors';
import { logAuditEvent } from '@/middleware/audit';

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

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Update last login timestamp
    await prisma.appUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.generateToken(user.id);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      req,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
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
