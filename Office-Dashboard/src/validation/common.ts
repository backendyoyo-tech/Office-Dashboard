import { z } from 'zod';

/**
 * Common schemas shared across modules.
 */

// UUID parameter validation
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

// Pagination query params
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Search/query filter base
export const searchSchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  sortBy: z.string().max(40).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Phone number ID param (used in nested routes)
export const phoneIdParamSchema = z.object({
  phoneId: z.string().uuid('Invalid phone number UUID'),
});

// Platform account ID param
export const accountIdParamSchema = z.object({
  accountId: z.string().uuid('Invalid platform account UUID'),
});

/**
 * Optimistic-locking version (REPAIR: D-006 / FR-018).
 * Optional for backwards compatibility; when supplied it enables stale-write
 * detection on the target resource.
 */
export const versionField = z.number().int().positive().optional();

/**
 * Password policy (REPAIR: SEC-001).
 * Minimum 8 characters and must not be a trivially guessable value.
 */
export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be at most 200 characters')
  .refine(v => /[A-Za-z]/.test(v), 'Password must contain at least one letter')
  .refine(v => /[0-9]/.test(v), 'Password must contain at least one number');

export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
