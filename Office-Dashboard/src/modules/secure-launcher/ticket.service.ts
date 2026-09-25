import crypto, { randomUUID } from 'crypto';
import prisma from '@/lib/db/prisma';
import { assertApprovedPlatformDevice } from '@/lib/platform-device';
import { officialPlatformHome } from '@/lib/platform-url';
import { AppError, ErrorCode, ForbiddenError } from '@/types/errors';
import type { PlatformLaunchOperation } from './grant.service';
import { requireActivePhoneAccountLink } from '@/lib/association';

type TicketClaims = {
  iss: 'hair-rap-api'; aud: 'hair-rap-launcher';
  nonce: string; deviceId: string; phoneNumberId: string;
  platformAccountId: string; mappingId: string; mappingVersion: number;
  operation: PlatformLaunchOperation; exp: number;
};

function ticketKey(): string {
  const key = process.env.LAUNCH_TICKET_SECRET;
  if (!key || key.length < 32) throw new Error('LAUNCH_TICKET_SECRET must be at least 32 characters');
  return key;
}

function sign(claims: TicketClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const mac = crypto.createHmac('sha256', ticketKey()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(raw: string): TicketClaims {
  if (raw.length > 4096) throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Invalid launch ticket');
  const parts = raw.split('.');
  if (parts.length !== 2) throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Invalid launch ticket');
  const expected = crypto.createHmac('sha256', ticketKey()).update(parts[0]).digest();
  let actual: Buffer;
  try { actual = Buffer.from(parts[1], 'base64url'); } catch {
    throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Invalid launch ticket');
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Invalid launch ticket');
  }
  let claims: TicketClaims;
  try { claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch {
    throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Invalid launch ticket');
  }
  if (claims.iss !== 'hair-rap-api' || claims.aud !== 'hair-rap-launcher' ||
    !/^[a-f0-9]{64}$/.test(claims.nonce) || !Number.isInteger(claims.mappingVersion) ||
    !['SETUP', 'OPEN', 'RECONNECT'].includes(claims.operation)) {
    throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Invalid launch ticket');
  }
  if (!Number.isInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new AppError(ErrorCode.LAUNCH_TICKET_EXPIRED, 'Launch ticket expired');
  }
  return claims;
}

export class LaunchTicketService {
  async issuePlatform(input: {
    actorUserId: string; deviceId: string; phoneNumberId: string; platformAccountId: string;
    operation: PlatformLaunchOperation; grantId: string; grantSecret: string; expectedVersion?: number;
  }) {
    ticketKey();
    if (!/^[a-f0-9]{64}$/.test(input.grantSecret)) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Invalid launch grant');
    }
    const hash = crypto.createHash('sha256').update(input.grantSecret).digest('hex');
    const now = new Date();
    const result = await prisma.$transaction(async tx => {
      // Serializes issuance/consumption against device revoke and disable.
      await tx.$queryRaw`SELECT id FROM registered_devices WHERE id = ${input.deviceId}::uuid FOR UPDATE`;
      const grant = await tx.launchGrant.findUnique({ where: { secretHash: hash } });
      if (!grant || grant.id !== input.grantId || grant.actorUserId !== input.actorUserId || grant.deviceId !== input.deviceId ||
        grant.phoneNumberId !== input.phoneNumberId || grant.platformAccountId !== input.platformAccountId ||
        grant.operation !== input.operation || grant.revokedAt || grant.consumedAt || grant.expiresAt <= now) {
        throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Invalid launch grant');
      }
      const user = await tx.appUser.findUnique({ where: { id: grant.actorUserId } });
      if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'EDITOR'].includes(user.role) ||
        user.refreshTokenHash !== grant.authSessionHash || user.version !== grant.userVersion) {
        throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Launch grant is no longer valid');
      }
      const link = await tx.phoneAccountLink.findFirst({
        where: {
          phoneNumberId: input.phoneNumberId, platformAccountId: input.platformAccountId,
          phoneNumber: { status: 'ACTIVE', archivedAt: null },
          platformAccount: { archivedAt: null, platform: { isActive: true } }
        },
      });
      if (!link) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Association is no longer valid');
      const device = await tx.registeredDevice.findUnique({ where: { id: input.deviceId } });
      if (!device) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Device is not approved');
      assertApprovedPlatformDevice(device);
      let mapping = await tx.devicePlatformSession.findUnique({
        where: { deviceId_platformAccountId: { deviceId: input.deviceId, platformAccountId: input.platformAccountId } },
      });
      if (!mapping && input.operation === 'SETUP' && input.expectedVersion === undefined) {
        mapping = await tx.devicePlatformSession.create({
          data: {
            id: randomUUID(),
            deviceId: input.deviceId,
            platformAccountId: input.platformAccountId,
            profileKey: crypto.randomBytes(16).toString('hex'),
          },
        });
      }
      if (!mapping || mapping.disabledAt || mapping.state === 'DISABLED' ||
        (input.expectedVersion !== undefined && mapping.version !== input.expectedVersion) ||
        (input.operation === 'SETUP' && mapping.state === 'USER_CONFIRMED') ||
        (input.operation === 'OPEN' && mapping.state !== 'USER_CONFIRMED')) {
        throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Account session is not ready on this PC');
      }
      const consumed = await tx.launchGrant.updateMany({
        where: { id: grant.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Launch grant already used');

      await tx.launchTicket.updateMany({ where: { devicePlatformSessionId: mapping.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
      mapping = await tx.devicePlatformSession.update({
        where: { id: mapping.id }, data: {
          version: { increment: 1 }, lastLaunchRequestedAt: now, lastLaunchResult: null,
          ...(input.operation !== 'OPEN' ? { state: 'SETUP_IN_PROGRESS', confirmedAt: null, confirmedByUserId: null, confirmedIdentifier: null } : {}),
        }
      });

      const nonce = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 45_000);
      const ticket = await tx.launchTicket.create({
        data: {
          id: randomUUID(),
          nonceHash: crypto.createHash('sha256').update(nonce).digest('hex'),
          grantId: grant.id,
          deviceId: input.deviceId,
          devicePlatformSessionId: mapping.id,
          operation: input.operation,
          mappingVersion: mapping.version,
          expiresAt,
        },
      });
      const metadata = { deviceId: input.deviceId, phoneNumberId: input.phoneNumberId, operationId: ticket.id, operation: input.operation };
      await tx.auditLog.createMany({
        data: [
          { actorUserId: input.actorUserId, action: 'LAUNCH_TICKET_ISSUED', entityType: 'PLATFORM_ACCOUNT', entityId: input.platformAccountId, metadata },
          { actorUserId: input.actorUserId, action: input.operation === 'OPEN' ? 'LAUNCH_REQUESTED' : 'ACCOUNT_SESSION_SETUP', entityType: 'PLATFORM_ACCOUNT', entityId: input.platformAccountId, metadata },
        ]
      });
      return { ticket, mapping, nonce, expiresAt };
    });
    const claims: TicketClaims = {
      iss: 'hair-rap-api', aud: 'hair-rap-launcher', nonce: result.nonce,
      deviceId: input.deviceId, phoneNumberId: input.phoneNumberId,
      platformAccountId: input.platformAccountId, mappingId: result.mapping.id,
      mappingVersion: result.mapping.version, operation: input.operation,
      exp: Math.floor(result.expiresAt.getTime() / 1000),
    };
    return {
      operationId: result.ticket.id, ticket: sign(claims), expiresAt: result.expiresAt,
      sessionId: result.mapping.id, version: result.mapping.version
    };
  }

  async consumePlatform(rawTicket: string, authenticatedDeviceId: string) {
    const claims = verify(rawTicket);
    if (claims.deviceId !== authenticatedDeviceId) {
      throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Ticket is for another device');
    }
    const hash = crypto.createHash('sha256').update(claims.nonce).digest('hex');
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM registered_devices WHERE id = ${authenticatedDeviceId}::uuid FOR UPDATE`;
      const ticket = await tx.launchTicket.findUnique({
        where: { nonceHash: hash },
      });

      const mapping = ticket
        ? await tx.devicePlatformSession.findUnique({
          where: { id: ticket.devicePlatformSessionId },
        })
        : null;

      const grant = ticket
        ? await tx.launchGrant.findUnique({
          where: { id: ticket.grantId },
        })
        : null;
      // const mapping = ticket?.devicePlatformSession;
      // const grant = ticket?.grant;
      const now = new Date();
      if (!ticket || !mapping || !grant || ticket.deviceId !== authenticatedDeviceId ||
        ticket.operation !== claims.operation || grant.operation !== claims.operation ||
        grant.deviceId !== authenticatedDeviceId ||
        mapping.id !== claims.mappingId || mapping.version !== claims.mappingVersion ||
        mapping.deviceId !== authenticatedDeviceId || mapping.platformAccountId !== claims.platformAccountId ||
        grant.phoneNumberId !== claims.phoneNumberId || grant.platformAccountId !== claims.platformAccountId ||
        ticket.revokedAt || grant.revokedAt || ticket.usedAt || ticket.expiresAt <= now || mapping.disabledAt || mapping.state === 'DISABLED' ||
        (claims.operation === 'OPEN' && mapping.state !== 'USER_CONFIRMED')) {
        throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Launch ticket is no longer valid');
      }
      const user = await tx.appUser.findUnique({ where: { id: grant.actorUserId } });
      const device = await tx.registeredDevice.findUnique({ where: { id: authenticatedDeviceId } });
      if (!user || user.status !== 'ACTIVE' || !['ADMIN', 'EDITOR'].includes(user.role) || user.version !== grant.userVersion ||
        user.refreshTokenHash !== grant.authSessionHash || !device) {
        throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Launch ticket is no longer valid');
      }
      assertApprovedPlatformDevice(device);
      await requireActivePhoneAccountLink(claims.phoneNumberId, claims.platformAccountId, tx);
      const used = await tx.launchTicket.updateMany({
        where: { id: ticket.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (used.count !== 1) throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Ticket already used');
      const platformAccount = await tx.platformAccount.findUnique({
        where: { id: mapping.platformAccountId },
        include: { platform: true },
      });

      if (!platformAccount) {
        throw new ForbiddenError(
          ErrorCode.LAUNCH_TICKET_INVALID,
          'Platform account not found'
        );
      }

      const targetUrl = officialPlatformHome(platformAccount.platform.slug);
      if (!targetUrl) throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Platform is not supported');
      return { operationId: ticket.id, operation: ticket.operation, profileKey: mapping.profileKey, targetUrl };
    });
  }
}

export const launchTicketService = new LaunchTicketService();
