import { z } from 'zod';
import { searchSchema, versionField } from './common';

/**
 * Validation schemas for Device management (Phase 2).
 */

const safeText = (max: number, label: string, min = 0) =>
  z
    .string()
    .min(min, `${label} must be at least ${min} character(s)`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine(v => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(v), `${label} contains control characters`)
    .refine(v => !/<[a-zA-Z/!]/.test(v), `${label} must not contain HTML markup`);

export const createDeviceSchema = z.object({
  deviceCode: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Device code must be alphanumeric with hyphens/underscores').optional(),
  friendlyName: safeText(120, 'Friendly name', 1),
  hostname: safeText(255, 'Hostname').optional(),
});

export const updateDeviceSchema = z.object({
  friendlyName: safeText(120, 'Friendly name', 1).optional(),
  hostname: safeText(255, 'Hostname').optional(),
  enabled: z.boolean().optional(),
  // REPAIR D-006 — stale-write detection
  version: versionField,
}).refine(data => Object.keys(data).filter(k => k !== 'version').length > 0, {
  message: 'At least one field must be provided',
});

/**
 * `enabled` query flag. `z.coerce.boolean()` is unusable here because the
 * string "false" coerces to `true` — explicit parsing fixes that.
 */
const booleanQuery = z
  .union([z.boolean(), z.string()])
  .transform(v => {
    if (typeof v === 'boolean') return v;
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(s)) return true;
    if (['false', '0', 'no'].includes(s)) return false;
    throw new Error('enabled must be true or false');
  });

export const listDeviceSchema = searchSchema.extend({
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN', 'DISABLED']).optional(),
  enabled: booleanQuery.optional(),
});

export const heartbeatSchema = z.object({
  launcherVersion: safeText(40, 'Launcher version').optional(),
  hostname: safeText(255, 'Hostname').optional(),
});

export const disableDeviceSchema = z.object({
  reason: safeText(500, 'Reason').optional(),
  version: versionField,
}).optional();

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type ListDeviceInput = z.infer<typeof listDeviceSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
