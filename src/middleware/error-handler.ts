import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '@/types/errors';
import { ZodError } from 'zod';

/**
 * Global error handler middleware.
 * Must be registered AFTER all routes.
 * Returns structured error responses with stable error codes.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Application errors with known codes
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Prisma known errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      res.status(409).json({
        error: {
          code: ErrorCode.DUPLICATE_ENTRY,
          message: 'A record with this value already exists',
        },
      });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Record not found',
        },
      });
      return;
    }
  }

  // Log unexpected errors in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', err);
  }

  // Generic 500 - don't leak internal details
  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An internal error occurred',
    },
  });
}
