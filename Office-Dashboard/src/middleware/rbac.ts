import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError, ErrorCode } from '@/types/errors';

/**
 * Role-based access control middleware factory.
 * Creates middleware that checks if the authenticated user has one of the allowed roles.
 * 
 * Usage: requireRole('ADMIN', 'EDITOR')
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError(ErrorCode.UNAUTHORIZED, 'Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError(
        ErrorCode.FORBIDDEN,
        `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      ));
      return;
    }

    next();
  };
}

/**
 * Shorthand: require ADMIN role.
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Shorthand: require ADMIN or EDITOR role.
 */
export const requireEditor = requireRole('ADMIN', 'EDITOR');

/**
 * Any authenticated user (ADMIN, EDITOR, VIEWER).
 */
export const requireAuth = requireRole('ADMIN', 'EDITOR', 'VIEWER');
