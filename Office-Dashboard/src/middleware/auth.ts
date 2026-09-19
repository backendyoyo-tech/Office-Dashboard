import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/db/prisma';
import { AppError, ErrorCode, UnauthorizedError } from '@/types/errors';
import type { AuthUser } from '@/types/express';

/**
 * JWT authentication middleware.
 * Extracts and validates Bearer token, loads user from DB,
 * attaches user to request.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED, 'Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    let payload: { userId: string };
    try {
      payload = jwt.verify(token, jwtSecret) as { userId: string };
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError(ErrorCode.TOKEN_EXPIRED, 'Token has expired');
      }
      throw new UnauthorizedError(ErrorCode.TOKEN_INVALID, 'Invalid token');
    }

    const user = await prisma.appUser.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError(ErrorCode.TOKEN_INVALID, 'User not found');
    }

    if (user.status === 'DISABLED') {
      throw new UnauthorizedError(ErrorCode.ACCOUNT_DISABLED, 'Account has been disabled');
    }

    req.user = user as AuthUser;
    next();
  } catch (err) {
    next(err);
  }
}
