import { z } from 'zod';
import { paginationSchema, searchSchema, versionField, passwordField } from './common';

/**
 * Validation schemas for Phone Number CRUD.
 */

// E.164 format: +[country][number], 8-15 digits total
const e164Regex = /^\+[1-9]\d{6,14}$/;

/**
 * Text fields are sanitised at the schema boundary (REPAIR: D-017 / SEC-007).
 * Angle brackets, HTML tags and control characters are rejected outright so
 * the API never persists a stored-XSS payload. Legitimate text is unaffected.
 */
const safeText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} must be at most ${max} characters`)
    .refine(v => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(v), `${label} contains control characters`)
    .refine(v => !/<[a-zA-Z/!]/.test(v), `${label} must not contain HTML markup`)
    .refine(v => !/javascript\s*:/i.test(v), `${label} must not contain script URLs`);

export const createPhoneSchema = z.object({
  e164Number: z.string().regex(e164Regex, 'Must be a valid E.164 phone number (e.g. +141****1234)'),
  countryCode: z.string().optional(),
  nationalNumber: z.string().optional(),
  label: safeText(120, 'Label').optional(),
  simProvider: safeText(80, 'SIM provider').optional(),
  notes: safeText(2000, 'Notes').optional(),
});

export const updatePhoneSchema = z.object({
  label: safeText(120, 'Label').optional(),
  simProvider: safeText(80, 'SIM provider').optional(),
  notes: safeText(2000, 'Notes').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  version: versionField,
}).refine(data => Object.keys(data).filter(k => k !== 'version').length > 0, {
  message: 'At least one field must be provided',
});

export const listPhoneSchema = searchSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  whatsappStatus: z.enum(['SETUP_REQUIRED', 'LINKING', 'LINKED', 'RELOGIN_REQUIRED', 'DISABLED', 'ERROR', 'UNKNOWN']).optional(),
  completeness: z.enum(['COMPLETE', 'PARTIAL', 'EMPTY']).optional(),
});

export const linkPhoneSchema = z.object({
  platformAccountId: z.string().uuid('Invalid platform account UUID'),
  relationshipType: z.enum(['GENERAL', 'LOGIN', 'RECOVERY']).default('GENERAL'),
  isPrimary: z.boolean().default(false),
});

export const archivePhoneSchema = z.object({
  reason: safeText(500, 'Reason').optional(),
  version: versionField,
});

export const restorePhoneSchema = z.object({
  version: versionField,
}).optional();

export const setCredentialField = passwordField;

export type CreatePhoneInput = z.infer<typeof createPhoneSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
export type ListPhoneInput = z.infer<typeof listPhoneSchema>;
