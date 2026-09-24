import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { assertApprovedPlatformDevice } from '@/lib/platform-device';
import { ErrorCode, ForbiddenError } from '@/types/errors';

export type LocalProof = {
  deviceId: string;
  purpose: 'grant' | 'confirm';
  referenceId: string;
  timestamp: number;
  signature: string;
};

/** Verify possession of the paired launcher on the initiating Windows PC. */
export async function verifyLocalProof(proof: LocalProof, purpose: 'grant' | 'confirm', referenceId: string) {
  if (!proof || proof.purpose !== purpose || proof.referenceId !== referenceId ||
    !Number.isInteger(proof.timestamp) || Math.abs(Date.now() - proof.timestamp) > 30_000 ||
    !/^[a-f0-9]{64}$/.test(proof.signature)) {
    throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Local launcher proof is invalid');
  }
  const device = await prisma.registeredDevice.findUnique({ where: { id: proof.deviceId } });
  if (!device) throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Local launcher proof is invalid');
  assertApprovedPlatformDevice(device);
  const message = `${purpose}|${referenceId}|${device.id}|${proof.timestamp}`;

  // const expected = crypto.createHmac('sha256', device.launcherApiKeyHash!).update(message).digest();
  const hmacKey = Buffer.from(device.launcherApiKeyHash!, 'ascii');

  const expected = crypto
    .createHmac('sha256', hmacKey)
    .update(message)
    .digest();

  const actual = Buffer.from(proof.signature, 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    throw new ForbiddenError(ErrorCode.FORBIDDEN, 'Local launcher proof is invalid');
  }
  return device;
}
