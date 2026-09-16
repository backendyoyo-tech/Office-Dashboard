import { z } from 'zod';
import { searchSchema } from './common';

/**
 * Validation schemas for Platform Account CRUD.
 */

export const createAccountSchema = z.object({
  platformId: z.number().int().positive(),
  displayName: z.string().max(160).optional(),
  accountHandle: z.string().max(160).optional(),
  loginIdentifier: z.string().max(160).optional(),
  profileUrl: z.string().url().max(500).optional().or(z.literal('')),
  externalAccountId: z.string().max(160).optional(),
  accountStatus: z.enum(['ACTIVE', 'INACTIVE', 'LOGIN_ISSUE', 'SUSPENDED', 'UNKNOWN']).default('UNKNOWN'),
  notes: z.string().max(2000).optional(),
});

export const updateAccountSchema = z.object({
  displayName: z.string().max(160).optional(),
  accountHandle: z.string().max(160).optional(),
  loginIdentifier: z.string().max(160).optional(),
  profileUrl: z.string().url().max(500).optional().or(z.literal('')),
  externalAccountId: z.string().max(160).optional(),
  accountStatus: z.enum(['ACTIVE', 'INACTIVE', 'LOGIN_ISSUE', 'SUSPENDED', 'UNKNOWN']).optional(),
  notes: z.string().max(2000).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export const listAccountSchema = searchSchema.extend({
  platformId: z.coerce.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOGIN_ISSUE', 'SUSPENDED', 'UNKNOWN']).optional(),
});

// Linking phone to account
export const linkAccountSchema = z.object({
  phoneNumberId: z.string().uuid('Invalid phone number UUID'),
  relationshipType: z.enum(['GENERAL', 'LOGIN', 'RECOVERY']).default('GENERAL'),
  isPrimary: z.boolean().default(false),
});

export const unlinkAccountSchema = z.object({
  phoneNumberId: z.string().uuid('Invalid phone number UUID'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountInput = z.infer<typeof listAccountSchema>;
export type LinkAccountInput = z.infer<typeof linkAccountSchema>;
