import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
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
