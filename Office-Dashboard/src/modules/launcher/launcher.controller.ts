import { Request, Response, NextFunction } from 'express';
import { launcherService } from './launcher.service';
import { whatsappService } from '@/modules/whatsapp/whatsapp.service';
import { AppError, ErrorCode } from '@/types/errors';
import { z } from 'zod';

const registerSchema = z.object({
  deviceCode: z.string().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/),
  friendlyName: z.string().min(1).max(120),
  hostname: z.string().max(255).optional(),
  launcherVersion: z.string().max(40).optional(),
});

const heartbeatSchema = z.object({
  launcherVersion: z.string().max(40).optional(),
  hostname: z.string().max(255).optional(),
});

const confirmSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  success: z.boolean(),
  error: z.string().optional(),
});

const statusSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  status: z.string().min(1).max(40),
  error: z.string().optional(),
});

export class LauncherController {
  /**
   * Register/claim a device from the launcher.
   * Public endpoint - the API key is generated and returned.
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      // REPAIR D-024 — registration is authorised, not anonymous.
      const result = await launcherService.registerDevice(data, {
        actorAdminId: (req as any).launcherAdmin?.id ?? null,
        enrollmentKey: (req as any).enrollmentKey ?? null,
        presentedApiKey: (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.substring(7)
          : null),
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Launcher heartbeat — uses launcher API key auth.
   */
  async heartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      const data = heartbeatSchema.parse(req.body || {});
      const result = await launcherService.heartbeat(device.id, data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dashboard-initiated launch command.
   * Forward the command to the launcher by returning it in the response.
   */
  async whatsappLaunch(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      const commands = await launcherService.getPendingCommands(device.id);
      res.json({
        deviceId: device.id,
        deviceCode: device.deviceCode,
        commands,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Launcher confirms whether the browser launched successfully.
   */
  async whatsappConfirm(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      const data = confirmSchema.parse(req.body);

      // Look up session by UUID
      const session = await whatsappService.getBySessionId(data.session_id);

      // Validate session belongs to this device
      if (session.deviceId !== device.id) {
        throw new AppError(ErrorCode.WA_DEVICE_MISMATCH, 'Session is not assigned to this device');
      }

      // Process the browser launch confirmation through the WhatsApp service
      const result = await whatsappService.browserLaunchConfirmed(
        session.phoneNumberId,
        data.success,
        data.error,
        device,
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Launcher reports session status change.
   */
  async whatsappStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      const data = statusSchema.parse(req.body);

      // Look up session by UUID
      const session = await whatsappService.getBySessionId(data.session_id);

      // Validate session belongs to this device
      if (session.deviceId !== device.id) {
        throw new AppError(ErrorCode.WA_DEVICE_MISMATCH, 'Session is not assigned to this device');
      }

      // Map launcher status values to database enum values.
      // 'running' means browser is open but QR not yet scanned → stays LINKING.
      // 'linked' is sent only if the launcher detects a successful QR scan.
      const launcherStatusMap: Record<string, string> = {
        launching: 'LINKING',
        running: 'LINKING',
        closed: 'RELOGIN_REQUIRED',
        error: 'ERROR',
        linked: 'LINKED',
      };
      const mappedStatus = launcherStatusMap[data.status.toLowerCase()] || 'UNKNOWN';

      // Process the status update through the WhatsApp service
      const result = await whatsappService.statusUpdate(
        session.phoneNumberId,
        {
          sessionCode: session.sessionCode,
          status: mappedStatus,
          error: data.error,
        },
        device,
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const launcherController = new LauncherController();
