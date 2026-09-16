import { z } from 'zod';
import { paginationSchema, searchSchema } from './common';

/**
 * Validation schemas for Phone Number CRUD.
 */

// E.164 format: +[country][number], 8-15 digits total
const e164Regex = /^\+[1-9]\d{6,14}$/;

export const createPhoneSchema = z.object({
  phoneNumber: z.string().regex(e164Regex, 'Must be a valid E.164 phone number (e.g. +14155551234)'),
  label: z.string().max(120).optional(),
  simProvider: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
});

export const updatePhoneSchema = z.object({
  label: z.string().max(120).optional(),
  simProvider: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export const listPhoneSchema = searchSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

export const archivePhoneSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreatePhoneInput = z.infer<typeof createPhoneSchema>;
export type UpdatePhoneInput = z.infer<typeof updatePhoneSchema>;
export type ListPhoneInput = z.infer<typeof listPhoneSchema>;
