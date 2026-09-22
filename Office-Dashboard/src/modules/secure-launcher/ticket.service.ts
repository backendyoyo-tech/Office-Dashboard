import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { assertApprovedPlatformDevice } from '@/lib/platform-device';
import { officialPlatformHome } from '@/lib/platform-url';
import { AppError, ErrorCode, ForbiddenError } from '@/types/errors';
import type { PlatformLaunchOperation } from './grant.service';

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
    operation: PlatformLaunchOperation; grantId: string; grantSecret: string; expectedVersion: number;
  }) {
    ticketKey();
    if (!/^[a-f0-9]{64}$/.test(input.grantSecret)) {
      throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Invalid launch grant');
    }
    const hash = crypto.createHash('sha256').update(input.grantSecret).digest('hex');
    const now = new Date();
    const result = await prisma.$transaction(async tx => {
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
        where: { phoneNumberId: input.phoneNumberId, platformAccountId: input.platformAccountId,
          phoneNumber: { status: 'ACTIVE', archivedAt: null },
          platformAccount: { archivedAt: null, platform: { isActive: true } } },
      });
      if (!link) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Association is no longer valid');
      const device = await tx.registeredDevice.findUnique({ where: { id: input.deviceId } });
      if (!device) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Device is not approved');
      assertApprovedPlatformDevice(device);
      const mapping = await tx.devicePlatformSession.findUnique({
        where: { deviceId_platformAccountId: { deviceId: input.deviceId, platformAccountId: input.platformAccountId } },
      });
      if (!mapping || mapping.disabledAt || mapping.version !== input.expectedVersion ||
          (input.operation === 'OPEN' && mapping.state !== 'USER_CONFIRMED')) {
        throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Account session is not ready on this PC');
      }
      const consumed = await tx.launchGrant.updateMany({
        where: { id: grant.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Launch grant already used');

      const nonce = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 45_000);
      const ticket = await tx.launchTicket.create({ data: {
        nonceHash: crypto.createHash('sha256').update(nonce).digest('hex'), grantId: grant.id,
        deviceId: input.deviceId, devicePlatformSessionId: mapping.id,
        operation: input.operation, mappingVersion: mapping.version, expiresAt,
      } });
      return { ticket, mapping, nonce, expiresAt };
    });
    const claims: TicketClaims = {
      iss: 'hair-rap-api', aud: 'hair-rap-launcher', nonce: result.nonce,
      deviceId: input.deviceId, phoneNumberId: input.phoneNumberId,
      platformAccountId: input.platformAccountId, mappingId: result.mapping.id,
      mappingVersion: result.mapping.version, operation: input.operation,
      exp: Math.floor(result.expiresAt.getTime() / 1000),
    };
    return { operationId: result.ticket.id, ticket: sign(claims), expiresAt: result.expiresAt };
  }

  async consumePlatform(rawTicket: string, authenticatedDeviceId: string) {
    const claims = verify(rawTicket);
    if (claims.deviceId !== authenticatedDeviceId) {
      throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Ticket is for another device');
    }
    const hash = crypto.createHash('sha256').update(claims.nonce).digest('hex');
    return prisma.$transaction(async tx => {
      const ticket = await tx.launchTicket.findUnique({ where: { nonceHash: hash }, include: {
        grant: true,
        devicePlatformSession: { include: { platformAccount: { include: { platform: true } } } },
      } });
      const mapping = ticket?.devicePlatformSession;
      const grant = ticket?.grant;
      const now = new Date();
      if (!ticket || !mapping || !grant || ticket.deviceId !== authenticatedDeviceId ||
          ticket.operation !== claims.operation || grant.operation !== claims.operation ||
          grant.deviceId !== authenticatedDeviceId ||
          mapping.id !== claims.mappingId || mapping.version !== claims.mappingVersion ||
          mapping.deviceId !== authenticatedDeviceId || mapping.platformAccountId !== claims.platformAccountId ||
          grant.phoneNumberId !== claims.phoneNumberId || grant.platformAccountId !== claims.platformAccountId ||
          ticket.revokedAt || ticket.usedAt || ticket.expiresAt <= now || mapping.disabledAt ||
          (claims.operation === 'OPEN' && mapping.state !== 'USER_CONFIRMED')) {
        throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Launch ticket is no longer valid');
      }
      const user = await tx.appUser.findUnique({ where: { id: grant.actorUserId } });
      const device = await tx.registeredDevice.findUnique({ where: { id: authenticatedDeviceId } });
      if (!user || user.status !== 'ACTIVE' || user.version !== grant.userVersion ||
          user.refreshTokenHash !== grant.authSessionHash || !device) {
        throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Launch ticket is no longer valid');
      }
      assertApprovedPlatformDevice(device);
      const link = await tx.phoneAccountLink.findFirst({
        where: { phoneNumberId: claims.phoneNumberId, platformAccountId: claims.platformAccountId,
          phoneNumber: { archivedAt: null, status: 'ACTIVE' }, platformAccount: { archivedAt: null } },
      });
      if (!link) throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Association was removed');
      const used = await tx.launchTicket.updateMany({
        where: { id: ticket.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (used.count !== 1) throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Ticket already used');
      const targetUrl = officialPlatformHome(mapping.platformAccount.platform.slug);
      if (!targetUrl) throw new ForbiddenError(ErrorCode.LAUNCH_TICKET_INVALID, 'Platform is not supported');
      return { operationId: ticket.id, operation: ticket.operation, profileKey: mapping.profileKey, targetUrl };
    });
  }
}

export const launchTicketService = new LaunchTicketService();
