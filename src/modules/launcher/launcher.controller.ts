import { Request, Response, NextFunction } from 'express';
import { launcherService } from './launcher.service';
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

export class LauncherController {
  /**
   * Register/claim a device from the launcher.
   * Public endpoint - the API key is generated and returned.
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await launcherService.registerDevice(data);
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
   * Launcher confirms link result.
   * This is a pass-through to the WhatsApp confirmLink endpoint.
   */
  async whatsappConfirm(req: Request, res: Response, next: NextFunction) {
    try {
      // The actual confirm-link logic is in the WhatsApp module.
      // This endpoint just validates the launcher auth and passes through.
      const device = (req as any).launcherDevice;
      res.json({
        status: 'acknowledged',
        deviceId: device.id,
        message: 'Use /phone-numbers/:phoneId/whatsapp/confirm-link for session confirmation',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Launcher reports session status.
   * Pass-through to WhatsApp status-update.
   */
  async whatsappStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      res.json({
        status: 'acknowledged',
        deviceId: device.id,
        message: 'Use /phone-numbers/:phoneId/whatsapp/status-update for session status updates',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const launcherController = new LauncherController();
