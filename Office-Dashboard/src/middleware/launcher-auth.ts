import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/db/prisma';
import { UnauthorizedError, ErrorCode, ForbiddenError } from '@/types/errors';

/**
 * Launcher API key authentication middleware.
 * Validates the launcher's Bearer token against stored hashed API keys.
 * Attaches the device to the request (as a custom property).
 */
export async function launcherAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError(ErrorCode.LAUNCHER_KEY_INVALID, 'Missing launcher API key');
    }

    const apiKey = authHeader.substring(7);
    if (!apiKey || apiKey.length < 16) {
      throw new UnauthorizedError(ErrorCode.LAUNCHER_KEY_INVALID, 'Invalid launcher API key format');
    }

    // Hash the provided key and look up the device
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const device = await prisma.registeredDevice.findFirst({
      where: {
        launcherApiKeyHash: keyHash,
        enabled: true,
      },
    });

    if (!device) {
      throw new UnauthorizedError(ErrorCode.LAUNCHER_KEY_INVALID, 'Invalid launcher API key');
    }

    if (device.status === 'DISABLED') {
      throw new ForbiddenError(ErrorCode.DEVICE_DISABLED, 'This device has been disabled');
    }

    // Attach device info to request for downstream use
    (req as any).launcherDevice = device;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Best-effort ADMIN authentication for device enrolment (REPAIR: D-024).
 *
 * Device registration is the only launcher endpoint that is not protected by a
 * device API key (the device does not have one yet). This middleware inspects
 * an optional `Authorization: Bearer <admin-jwt>` header and, when it is a
 * valid token for an active ADMIN, attaches `req.launcherAdmin`.
 *
 * It NEVER rejects: the caller decides whether an admin session, an enrolment
 * key, or the device's own existing API key is the acceptable proof.
 */
export async function optionalAdminAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET;
      if (secret && token && !token.startsWith('hr_launcher_')) {
        try {
          const payload = jwt.verify(token, secret) as { userId?: string };
          if (payload?.userId) {
            const admin = await prisma.appUser.findFirst({
              where: { id: payload.userId, role: 'ADMIN', status: 'ACTIVE' },
              select: { id: true },
            });
            if (admin) (req as any).launcherAdmin = admin;
          }
        } catch {
          // Ignore invalid tokens here; the enrolment check reports the failure.
        }
      }
    }

    // The raw key may also arrive as an X-Enrollment-Key header.
    const enrollmentKey = req.headers['x-enrollment-key'];
    if (typeof enrollmentKey === 'string' && enrollmentKey.length > 0) {
      (req as any).enrollmentKey = enrollmentKey;
    }

    next();
  } catch (err) {
    next(err);
  }
}
