import { z } from 'zod';
import { versionField } from './common';

/**
 * Validation schemas for WhatsApp session management (Phase 2).
 */

export const createWaSessionSchema = z.object({
  deviceId: z.string().uuid('Invalid device UUID'),
});

export const updateWaSessionSchema = z.object({
  deviceId: z.string().uuid('Invalid device UUID').optional(),
  newDeviceId: z.string().uuid('Invalid device UUID').optional(),
  status: z.enum(['SETUP_REQUIRED', 'LINKING', 'LINKED', 'RELOGIN_REQUIRED', 'DISABLED', 'ERROR', 'UNKNOWN']).optional(),
  // REPAIR D-006 — echo the version you last read for stale-write detection.
  // REPAIR D-027 — history of session directories is device-scoped.
  version: versionField,
}).refine(data => {
  const nonVersionKeys = Object.keys(data).filter(k => k !== 'version');
  return nonVersionKeys.length > 0;
}, {
  message: 'At least one field must be provided',
});

export const waConfirmLinkSchema = z.object({
  sessionCode: z.string().regex(/^HR-WA-\d{4,}$/, 'Invalid session code format'),
  success: z.boolean(),
  error: z.string().max(500).optional(),
});

export const waStatusUpdateSchema = z.object({
  sessionCode: z.string().regex(/^HR-WA-\d{4,}$/, 'Invalid session code format'),
  status: z.enum(['SETUP_REQUIRED', 'LINKING', 'LINKED', 'RELOGIN_REQUIRED', 'DISABLED', 'ERROR', 'UNKNOWN']),
  error: z.string().max(500).optional(),
});

export const waActionSchema = z.object({
  // No body required for setup/open/reconnect — phone ID is in the URL
});

export type CreateWaSessionInput = z.infer<typeof createWaSessionSchema>;
export type UpdateWaSessionInput = z.infer<typeof updateWaSessionSchema>;
export type WaConfirmLinkInput = z.infer<typeof waConfirmLinkSchema>;
export type WaStatusUpdateInput = z.infer<typeof waStatusUpdateSchema>;
