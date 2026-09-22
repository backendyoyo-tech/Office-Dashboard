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
    res.json(session ? { id: session.id, deviceId, state: session.state, version: session.version,
      confirmedIdentifier: session.confirmedIdentifier, confirmedAt: session.confirmedAt } :
      { deviceId, state: 'SETUP_REQUIRED', version: null });
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
    const { session } = operation === 'SETUP'
      ? await platformSessionService.findOrCreate(phoneId, accountId, input.deviceId)
      : await platformSessionService.requireMapped(phoneId, accountId, input.deviceId);
    if (input.expectedVersion !== undefined && input.expectedVersion !== session.version) {
      throw new ConflictError(ErrorCode.CONCURRENCY_CONFLICT, 'Session changed; refresh and retry');
    }
    if (operation === 'SETUP' && session.state === 'USER_CONFIRMED') {
      throw new ConflictError(ErrorCode.CONCURRENCY_CONFLICT, 'This account is already confirmed on this PC');
    }
    const result = await launchTicketService.issuePlatform({
      actorUserId: req.user.id, deviceId: input.deviceId,
      phoneNumberId: phoneId, platformAccountId: accountId,
      operation, grantId: input.grantId, grantSecret: input.grantSecret, expectedVersion: session.version,
    });
    await prisma.devicePlatformSession.update({
      where: { id: session.id },
      data: { lastLaunchRequestedAt: new Date(), ...(operation === 'SETUP' ? { state: 'SETUP_IN_PROGRESS' as const } : {}) },
    });
    res.json({ operationId: result.operationId, ticket: result.ticket,
      expiresAt: result.expiresAt, localPort: 12345, sessionId: session.id, version: session.version,
      state: 'LAUNCH_REQUESTED' });
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
    const changed = await prisma.devicePlatformSession.updateMany({
      where: { id: sessionId, deviceId: input.deviceId, version: input.version,
        state: { in: ['SETUP_IN_PROGRESS', 'RELOGIN_REQUIRED', 'UNKNOWN'] }, disabledAt: null },
      data: { state: 'USER_CONFIRMED', confirmedIdentifier: input.confirmedIdentifier,
        confirmedByUserId: req.user!.id, confirmedAt: new Date(), version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictError(ErrorCode.CONCURRENCY_CONFLICT, 'Session changed; refresh and retry');
    await prisma.auditLog.create({ data: {
      actorUserId: req.user!.id, action: 'ACCOUNT_IDENTITY_CONFIRMED', entityType: 'PLATFORM_ACCOUNT',
      entityId: input.platformAccountId,
      metadata: { deviceId: input.deviceId, phoneNumberId: input.phoneNumberId, assurance: 'USER_CONFIRMED_ON_DEVICE' },
    } });
    res.json({ id: sessionId, state: 'USER_CONFIRMED', version: input.version + 1, assurance: 'USER_CONFIRMED_ON_DEVICE' });
  } catch (error) { next(error); }
});

router.get('/operations/:operationId', async (req, res, next) => {
  try {
    const { operationId } = z.object({ operationId: uuid }).parse(req.params);
    const ticket = await prisma.launchTicket.findUnique({ where: { id: operationId }, include: { grant: true } });
    if (!ticket || ticket.grant.actorUserId !== req.user!.id) throw new NotFoundError(ErrorCode.NOT_FOUND, 'Operation not found');
    const state = ticket.launchResult === 'DELIVERED' ? 'BROWSER_LAUNCHED' :
      ticket.launchResult === 'FAILED' ? 'LAUNCH_FAILED' : 'LAUNCH_REQUESTED';
    res.json({ operationId, state, errorCode: ticket.errorCode, acknowledgedAt: ticket.ackAt });
  } catch (error) { next(error); }
});

export default router;
