import { z } from 'zod';
import { searchSchema, versionField, passwordField } from './common';

/**
 * Validation schemas for Platform Account CRUD.
 */

/**
 * Repository-safe free text (REPAIR: D-017 / SEC-007).
 * Rejects HTML markup and control characters at the API boundary.
 */
const safeText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} must be at most ${max} characters`)
    .refine(v => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(v), `${label} contains control characters`)
    .refine(v => !/<[a-zA-Z/!]/.test(v), `${label} must not contain HTML markup`)
    .refine(v => !/javascript\s*:/i.test(v), `${label} must not contain script URLs`);

/**
 * Profile URL (REPAIR: D-018) — strictly http/https, no embedded credentials.
 * Empty string is normalised to `null` by the service layer.
 */
const profileUrlField = z
  .string()
  .max(500)
  .refine(
    v =>
      v === '' ||
      (() => {
        try {
          const u = new URL(v);
          return (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password;
        } catch {
          return false;
        }
      })(),
    'Profile URL must be a valid absolute http(s) URL without embedded credentials',
  );

export const createAccountSchema = z.object({
  platformId: z.coerce.number().int().positive(),
  displayName: safeText(160, 'Display name').optional(),
  accountHandle: safeText(160, 'Account handle').optional(),
  loginIdentifier: safeText(160, 'Login identifier').optional(),
  profileUrl: profileUrlField.optional(),
  externalAccountId: safeText(160, 'External account ID').optional(),
  accountStatus: z.enum(['ACTIVE', 'INACTIVE', 'LOGIN_ISSUE', 'SUSPENDED', 'UNKNOWN']).default('UNKNOWN'),
  notes: safeText(2000, 'Notes').optional(),
  /** 
   * REPAIR D-002 / D-003 — the password supplied at account-creation time is
   * now persisted (encrypted) in the same transaction as the account, so the
   * reveal endpoint works immediately.
   */
  password: passwordField.optional(),
});

export const updateAccountSchema = z.object({
  displayName: safeText(160, 'Display name').optional(),
  accountHandle: safeText(160, 'Account handle').optional(),
  loginIdentifier: safeText(160, 'Login identifier').optional(),
  profileUrl: profileUrlField.optional(),
  externalAccountId: safeText(160, 'External account ID').optional(),
  accountStatus: z.enum(['ACTIVE', 'INACTIVE', 'LOGIN_ISSUE', 'SUSPENDED', 'UNKNOWN']).optional(),
  notes: safeText(2000, 'Notes').optional(),
  version: versionField,
}).refine(data => Object.keys(data).filter(k => k !== 'version').length > 0, {
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

export const archiveAccountSchema = z.object({
  reason: safeText(500, 'Reason').optional(),
  version: versionField,
}).optional();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountInput = z.infer<typeof listAccountSchema>;
export type LinkAccountInput = z.infer<typeof linkAccountSchema>;
