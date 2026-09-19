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

export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
