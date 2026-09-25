import { Request, Response, NextFunction } from 'express';
import { launcherService } from './launcher.service';
import { whatsappService } from '@/modules/whatsapp/whatsapp.service';
import { AppError, ErrorCode } from '@/types/errors';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { launchTicketService } from '@/modules/secure-launcher/ticket.service';

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
  async platformCapability(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      const { launcherVersion } = z.object({ launcherVersion: z.string().regex(/^2\.[0-9]+\.[0-9]+$/) }).parse(req.body);
      const updated = await prisma.registeredDevice.updateMany({
        where: { id: device.id, enabled: true, approvalState: 'APPROVED' },
        data: { supportsPlatformLauncher: true, launcherVersion },
      });
      if (updated.count !== 1) throw new AppError(ErrorCode.FORBIDDEN, 'Device requires administrator approval');
      res.json({ approved: true, supportsPlatformLauncher: true });
    } catch (err) { next(err); }
  }

  async platformConsume(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      const { ticket } = z.object({ ticket: z.string().min(32).max(4096) }).parse(req.body);
      const result = await launchTicketService.consumePlatform(ticket, device.id);
      await prisma.auditLog.create({
        data: {
          actorUserId: null, action: 'LAUNCH_TICKET_CONSUMED', entityType: 'DEVICE', entityId: device.id,
          metadata: { operationId: result.operationId },
        }
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  async platformAck(req: Request, res: Response, next: NextFunction) {
    try {
      const device = (req as any).launcherDevice;
      const data = z.object({
        operationId: z.string().uuid(), result: z.enum(['DELIVERED', 'FAILED']),
        errorCode: z.enum(['BROWSER_MISSING', 'PROFILE_ERROR', 'LAUNCH_ERROR']).optional(),
      }).parse(req.body);

      const ticket = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM registered_devices WHERE id = ${device.id}::uuid FOR UPDATE`;

        const currentDevice = await tx.registeredDevice.findUniqueOrThrow({
          where: { id: device.id },
        });

        if (!currentDevice.enabled || currentDevice.approvalState !== 'APPROVED') {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            'Device is no longer approved'
          );
        }

        const existing = await tx.launchTicket.findFirst({
          where: {
            id: data.operationId,
            deviceId: device.id,
            usedAt: { not: null },
            revokedAt: null,
          },
        });

        if (!existing) {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            'Operation not available'
          );
        }

        const grant = await tx.launchGrant.findUnique({
          where: { id: existing.grantId },
        });

        if (!grant) {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            'Launch grant not found'
          );
        }

        // LaunchTicket no longer stores acknowledgement state.

        if (!existing.devicePlatformSessionId) {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            'Launch operation is not linked to a platform session'
          );
        }

        const changed = await tx.devicePlatformSession.updateMany({
          where: {
            id: existing.devicePlatformSessionId,
            version: existing.mappingVersion,
          },
          data: {
            lastLaunchResult: data.result,
          },
        });

        if (changed.count !== 1) {
          throw new AppError(
            ErrorCode.CONCURRENCY_CONFLICT,
            'Operation already acknowledged or mapping changed'
          );
        }

        await tx.auditLog.create({
          data: {
            actorUserId: grant.actorUserId,
            action:
              data.result === 'DELIVERED'
                ? 'LAUNCH_DELIVERED'
                : 'LAUNCH_FAILED',
            entityType: 'PLATFORM_ACCOUNT',
            entityId: grant.platformAccountId,
            metadata: {
              deviceId: device.id,
              phoneNumberId: grant.phoneNumberId,
              operationId: existing.id,
              errorCode: data.errorCode ?? null,
            },
          },
        });

        return existing;
      });
      res.json({ operationId: ticket.id, state: data.result === 'DELIVERED' ? 'BROWSER_LAUNCHED' : 'LAUNCH_FAILED' });
    } catch (err) { next(err); }
  }
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
