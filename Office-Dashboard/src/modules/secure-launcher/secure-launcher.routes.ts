import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { requireEditor } from '@/middleware/rbac';
import prisma from '@/lib/db/prisma';
import { requireActivePhoneAccountLink } from '@/lib/association';
import { ErrorCode, ConflictError, ForbiddenError, NotFoundError } from '@/types/errors';
import { launchGrantService } from './grant.service';
import { launchTicketService } from './ticket.service';
import { platformSessionService } from './session.service';
import { verifyLocalProof } from './local-proof';
import { effectiveDeviceStatus } from '@/lib/device-state';
import { assertApprovedPlatformDevice } from '@/lib/platform-device';

const router = Router();
router.use(authenticate, requireEditor);
const uuid = z.string().uuid();
const scope = z.object({ phoneNumberId: uuid, platformAccountId: uuid, deviceId: uuid });
const proofSchema = z.object({
  deviceId: uuid, purpose: z.enum(['grant', 'confirm']), referenceId: z.string().max(100),
  timestamp: z.number().int(), signature: z.string().regex(/^[a-f0-9]{64}$/),
});

router.post('/reauth', async (req, res, next) => {
  try {
    const input = scope.extend({ operation: z.enum(['SETUP', 'OPEN', 'RECONNECT']), password: z.string().min(1) }).parse(req.body);
    res.json(await launchGrantService.createForPlatform({ ...input, actorUserId: req.user!.id }));
  } catch (error) { next(error); }
});

router.get('/phone-numbers/:phoneId/accounts/:accountId/session', async (req, res, next) => {
  try {
    const { phoneId, accountId } = z.object({ phoneId: uuid, accountId: uuid }).parse(req.params);
    const { deviceId } = z.object({ deviceId: uuid }).parse(req.query);
    await requireActivePhoneAccountLink(phoneId, accountId);
    const session = await prisma.devicePlatformSession.findUnique({
      where: { deviceId_platformAccountId: { deviceId, platformAccountId: accountId } },
    });
    const device = await prisma.registeredDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundError(ErrorCode.NOT_FOUND, 'Device not found');
    const deviceInfo = {
      deviceName: device.friendlyName, deviceStatus: effectiveDeviceStatus(device),
      approvalState: device.approvalState, enabled: device.enabled, supportsPlatformLauncher: device.supportsPlatformLauncher
    };
    res.json(session ? {
      id: session.id, deviceId, state: session.state, version: session.version,
      confirmedIdentifier: session.confirmedIdentifier, confirmedAt: session.confirmedAt,
      lastLaunchResult: session.lastLaunchResult, ...deviceInfo
    } :
      { deviceId, state: 'SETUP_REQUIRED', version: null, ...deviceInfo });
  } catch (error) { next(error); }
});

async function issue(req: any, res: any, next: any, operation: 'SETUP' | 'OPEN') {
  try {
    const { phoneId, accountId } = z.object({ phoneId: uuid, accountId: uuid }).parse(req.params);
    const input = z.object({
      deviceId: uuid, grantId: uuid, grantSecret: z.string().regex(/^[a-f0-9]{64}$/),
      expectedVersion: z.number().int().positive().optional(), proof: proofSchema,
    }).parse(req.body);
    if (input.proof.deviceId !== input.deviceId) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Wrong local device');
    await verifyLocalProof(input.proof, 'grant', input.grantId);
    const result = await launchTicketService.issuePlatform({
      actorUserId: req.user.id, deviceId: input.deviceId,
      phoneNumberId: phoneId, platformAccountId: accountId,
      operation, grantId: input.grantId, grantSecret: input.grantSecret, expectedVersion: input.expectedVersion,
    });
    res.json({
      operationId: result.operationId, ticket: result.ticket,
      expiresAt: result.expiresAt, localPort: 12345, sessionId: result.sessionId, version: result.version,
      state: 'LAUNCH_REQUESTED'
    });
  } catch (error) { next(error); }
}

router.post('/phone-numbers/:phoneId/accounts/:accountId/setup', (req, res, next) => issue(req, res, next, 'SETUP'));
router.post('/phone-numbers/:phoneId/accounts/:accountId/open', (req, res, next) => issue(req, res, next, 'OPEN'));

router.post('/sessions/:sessionId/confirm', async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: uuid }).parse(req.params);
    const input = scope.extend({
      version: z.number().int().positive(),
      confirmedIdentifier: z.string().trim().min(1).max(160).regex(/^[^<>\u0000-\u001f]+$/),
      proof: proofSchema,
    }).parse(req.body);
    const { session } = await platformSessionService.requireMapped(input.phoneNumberId, input.platformAccountId, input.deviceId);
    if (session.id !== sessionId || input.proof.deviceId !== input.deviceId) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, 'Session not found on this device');
    }
    await verifyLocalProof(input.proof, 'confirm', `${sessionId}:${input.version}`);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM registered_devices WHERE id = ${input.deviceId}::uuid FOR UPDATE`;
      const device = await tx.registeredDevice.findUniqueOrThrow({ where: { id: input.deviceId } });
      assertApprovedPlatformDevice(device);
      await requireActivePhoneAccountLink(input.phoneNumberId, input.platformAccountId, tx);
      const delivered = await tx.launchTicket.findFirst({
        where: {
          devicePlatformSessionId: sessionId, mappingVersion: input.version,
          deviceId: input.deviceId, operation: { in: ['SETUP', 'RECONNECT'] },
          revokedAt: null,
          grant: { actorUserId: req.user!.id, phoneNumberId: input.phoneNumberId, platformAccountId: input.platformAccountId },
        }
      });
      if (!delivered) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Open setup on this PC successfully before confirming identity');
      const changed = await tx.devicePlatformSession.updateMany({
        where: {
          id: sessionId, deviceId: input.deviceId, version: input.version,
          state: 'SETUP_IN_PROGRESS', disabledAt: null
        },
        data: {
          state: 'USER_CONFIRMED', confirmedIdentifier: input.confirmedIdentifier,
          confirmedByUserId: req.user!.id, confirmedAt: new Date(), version: { increment: 1 }
        },
      });
      if (changed.count !== 1) throw new ConflictError(ErrorCode.CONCURRENCY_CONFLICT, 'Session changed; refresh and retry');
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id, action: 'ACCOUNT_IDENTITY_CONFIRMED', entityType: 'PLATFORM_ACCOUNT',
          entityId: input.platformAccountId,
          metadata: { deviceId: input.deviceId, phoneNumberId: input.phoneNumberId, assurance: 'USER_CONFIRMED_ON_DEVICE' },
        }
      });
    });
    res.json({ id: sessionId, state: 'USER_CONFIRMED', version: input.version + 1, assurance: 'USER_CONFIRMED_ON_DEVICE' });
  } catch (error) { next(error); }
});

router.post('/sessions/:sessionId/relogin-required', async (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: uuid }).parse(req.params);
    const input = scope.extend({ version: z.number().int().positive(), proof: proofSchema }).parse(req.body);
    if (input.proof.deviceId !== input.deviceId) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Wrong local device');
    await verifyLocalProof(input.proof, 'confirm', `${sessionId}:${input.version}`);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM registered_devices WHERE id = ${input.deviceId}::uuid FOR UPDATE`;
      assertApprovedPlatformDevice(await tx.registeredDevice.findUniqueOrThrow({ where: { id: input.deviceId } }));
      await requireActivePhoneAccountLink(input.phoneNumberId, input.platformAccountId, tx);
      const changed = await tx.devicePlatformSession.updateMany({
        where: {
          id: sessionId, deviceId: input.deviceId, platformAccountId: input.platformAccountId,
          version: input.version, disabledAt: null, state: { not: 'DISABLED' },
        }, data: {
          state: 'RELOGIN_REQUIRED', version: { increment: 1 }, confirmedAt: null,
          confirmedIdentifier: null, confirmedByUserId: null, lastLaunchResult: null
        }
      });
      if (changed.count !== 1) throw new ConflictError(ErrorCode.CONCURRENCY_CONFLICT, 'Session changed; refresh and retry');
      await tx.launchTicket.updateMany({ where: { devicePlatformSessionId: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id, action: 'ACCOUNT_SESSION_RELINK_REQUIRED',
          entityType: 'PLATFORM_ACCOUNT', entityId: input.platformAccountId,
          metadata: { phoneNumberId: input.phoneNumberId, deviceId: input.deviceId, sessionId }
        }
      });
    });
    res.json({ id: sessionId, state: 'RELOGIN_REQUIRED', version: input.version + 1 });
  } catch (error) { next(error); }
});

router.get('/operations/:operationId', async (req, res, next) => {
  try {
    const { operationId } = z.object({ operationId: uuid }).parse(req.params);

    const ticket = await prisma.launchTicket.findFirst({
      where: {
        id: operationId,
        usedAt: { not: null },
        revokedAt: null,
      },
      include: {
        grant: true,
        devicePlatformSession: true,
      },
    });

    if (!ticket || ticket.grant.actorUserId !== req.user!.id) {
      throw new NotFoundError(
        ErrorCode.NOT_FOUND,
        'Operation not found'
      );
    }

    const launchResult = ticket.devicePlatformSession?.lastLaunchResult;

    const state =
      ticket.revokedAt
        ? 'LAUNCH_REVOKED'
        : launchResult === 'DELIVERED'
          ? 'BROWSER_LAUNCHED'
          : launchResult === 'FAILED'
            ? 'LAUNCH_FAILED'
            : ticket.expiresAt <= new Date()
              ? 'LAUNCH_EXPIRED'
              : 'LAUNCH_REQUESTED';

    res.json({
      operationId,
      state,
      errorCode: null,
      acknowledgedAt: null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
