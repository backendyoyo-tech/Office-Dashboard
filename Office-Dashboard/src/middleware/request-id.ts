import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware.
 * Generates a unique request ID for each request.
 * Uses the X-Request-ID header if provided, otherwise generates a UUID.
 * Attaches the ID to both the request object and the response header.
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
