import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@/types/errors';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 * Validates the specified part of the request against a Zod schema.
 * Replaces the original value with the parsed (and transformed) value.
 *
 * Usage: validate(schema, 'body') or validate(schema, 'query')
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req[part]);
      (req as any)[part] = result;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ValidationError(err.issues));
      } else {
        next(err);
      }
    }
  };
}
