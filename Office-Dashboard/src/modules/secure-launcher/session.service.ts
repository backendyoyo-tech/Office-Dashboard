import crypto from 'crypto';
import { randomUUID } from 'crypto';
import prisma from '@/lib/db/prisma';
import { requireActivePhoneAccountLink } from '@/lib/association';
import { assertApprovedPlatformDevice } from '@/lib/platform-device';
import { ErrorCode, NotFoundError } from '@/types/errors';

/** Internal-only mapping service. Browser routes must prove local launcher possession first. */
export class PlatformSessionService {
  async findOrCreate(phoneNumberId: string, platformAccountId: string, deviceId: string) {
    const link = await requireActivePhoneAccountLink(phoneNumberId, platformAccountId);
    const device = await prisma.registeredDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    assertApprovedPlatformDevice(device);

    // The immutable platform account ID, not the selected phone or public URL,
    // owns this profile. One shared account linked to two phones reuses it.
    const session = await prisma.devicePlatformSession.upsert({
      where: { deviceId_platformAccountId: { deviceId, platformAccountId } },
      create: {
        id: randomUUID(),
        deviceId,
        platformAccountId,
        profileKey: crypto.randomBytes(16).toString('hex'),
      },
      update: {},
    });
    return { session, link };
  }

  async requireMapped(phoneNumberId: string, platformAccountId: string, deviceId: string) {
    const link = await requireActivePhoneAccountLink(phoneNumberId, platformAccountId);
    const device = await prisma.registeredDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundError(ErrorCode.DEVICE_NOT_FOUND, 'Device not found');
    assertApprovedPlatformDevice(device);
    const session = await prisma.devicePlatformSession.findUnique({
      where: { deviceId_platformAccountId: { deviceId, platformAccountId } },
    });
    if (!session || session.disabledAt) {
      throw new NotFoundError(ErrorCode.NOT_FOUND, 'Account is not set up on this device');
    }
    return { session, link };
  }
}

export const platformSessionService = new PlatformSessionService();
