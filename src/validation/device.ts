import { z } from 'zod';
import { searchSchema } from './common';

/**
 * Validation schemas for Device management (Phase 2).
 */

export const createDeviceSchema = z.object({
  deviceCode: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Device code must be alphanumeric with hyphens/underscores'),
  friendlyName: z.string().min(1).max(120),
  hostname: z.string().max(255).optional(),
});

export const updateDeviceSchema = z.object({
  friendlyName: z.string().min(1).max(120).optional(),
  hostname: z.string().max(255).optional(),
  enabled: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export const listDeviceSchema = searchSchema.extend({
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN', 'DISABLED']).optional(),
  enabled: z.coerce.boolean().optional(),
});

export const heartbeatSchema = z.object({
  launcherVersion: z.string().max(40).optional(),
  hostname: z.string().max(255).optional(),
});

export const disableDeviceSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type ListDeviceInput = z.infer<typeof listDeviceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
