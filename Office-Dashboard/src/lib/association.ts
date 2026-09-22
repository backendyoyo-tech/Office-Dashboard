import prisma from '@/lib/db/prisma';
import { ErrorCode, NotFoundError } from '@/types/errors';

/** Source of truth for every privileged number/account request. */
export async function requireActivePhoneAccountLink(phoneNumberId: string, platformAccountId: string) {
  const link = await prisma.phoneAccountLink.findFirst({
    where: {
      phoneNumberId,
      platformAccountId,
      phoneNumber: { archivedAt: null, status: 'ACTIVE' },
      platformAccount: { archivedAt: null, platform: { isActive: true } },
    },
    include: { platformAccount: { include: { platform: true } } },
  });
  if (!link) {
    // Do not reveal which identifier was valid to an unscoped caller.
    throw new NotFoundError(ErrorCode.NOT_FOUND, 'Number-account association not found');
  }
  return link;
}
