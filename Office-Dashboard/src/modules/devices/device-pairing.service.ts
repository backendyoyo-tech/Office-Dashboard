import crypto from 'node:crypto';
import { prisma } from '@/lib/db/prisma';

const PAIRING_TTL_MS = 15 * 60 * 1000;

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const bytes = crypto.randomBytes(8);

  let value = '';

  for (const byte of bytes) {
    value += alphabet[byte % alphabet.length];
  }

  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

function generatePairingSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function sha256(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');
}

function derivePairingKey(secret: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(secret, 'utf8')
    .digest();
}

function encryptApiKey(apiKey: string, pairingSecret: string) {
  const key = derivePairingKey(pairingSecret);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptApiKey(
  ciphertext: string,
  iv: string,
  authTag: string,
  pairingSecret: string,
): string {
  const key = derivePairingKey(pairingSecret);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64'),
  );

  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function generateLauncherApiKey(): {
  rawKey: string;
  hash: string;
} {
  const rawKey = `hr_launcher_${crypto.randomBytes(32).toString('hex')}`;

  return {
    rawKey,
    hash: sha256(rawKey),
  };
}

async function generateDeviceCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase();

    const deviceCode = `PC-${suffix}`;

    const existing = await prisma.registeredDevice.findUnique({
      where: { deviceCode },
      select: { id: true },
    });

    if (!existing) {
      return deviceCode;
    }
  }

  throw new Error('Unable to generate unique device code');
}

export class DevicePairingService {
  async createPairingRequest(data: {
    hostname?: string;
    friendlyName?: string;
    launcherVersion?: string;
  }) {
    const pairingSecret = generatePairingSecret();
    const pairingCode = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);

    /*
     * IMPORTANT:
     * We create the launcher credential now, encrypt it with the
     * pairing secret, and store only the encrypted form.
     *
     * The raw API key is never stored in plaintext and is never
     * returned to the dashboard.
     */
    const { rawKey, hash } = generateLauncherApiKey();

    const encrypted = encryptApiKey(rawKey, pairingSecret);

    const pairing = await prisma.devicePairingRequest.create({
      data: {
        pairingCode,
        secretHash: sha256(pairingSecret),
        hostname: data.hostname,
        friendlyName: data.friendlyName,
        launcherVersion: data.launcherVersion,
        apiKeyHash: hash,
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyAuthTag: encrypted.authTag,
        expiresAt,
      },
    });

    /*
     * Do not log pairingSecret or rawKey.
     *
     * hash is intentionally NOT returned. It is retained below only
     * as the value that will be used when the device is approved.
     */
    void hash;

    return {
      pairingId: pairing.id,
      pairingCode: pairing.pairingCode,
      pairingSecret,
      expiresAt: pairing.expiresAt,
    };
  }

  async getPairingStatus(
    pairingId: string,
    pairingSecret: string,
  ) {
    const secretHash = sha256(pairingSecret);

    const pairing = await prisma.devicePairingRequest.findUnique({
      where: { id: pairingId },
    });

    if (!pairing) {
      throw new Error('Pairing request not found');
    }

    if (pairing.secretHash !== secretHash) {
      throw new Error('Invalid pairing secret');
    }

    if (
      pairing.status === 'PENDING' &&
      pairing.expiresAt.getTime() <= Date.now()
    ) {
      await prisma.devicePairingRequest.update({
        where: { id: pairing.id },
        data: {
          status: 'EXPIRED',
        },
      });

      return {
        status: 'EXPIRED' as const,
      };
    }

    if (pairing.status === 'PENDING') {
      return {
        status: 'PENDING' as const,
        expiresAt: pairing.expiresAt,
      };
    }

    if (pairing.status === 'CONSUMED') {
      return {
        status: 'CONSUMED' as const,
      };
    }

    if (pairing.status === 'REJECTED') {
      return {
        status: 'REJECTED' as const,
      };
    }

    if (pairing.status !== 'APPROVED' || !pairing.deviceId) {
      return {
        status: pairing.status,
      };
    }

    const apiKey = decryptApiKey(
      pairing.apiKeyCiphertext,
      pairing.apiKeyIv,
      pairing.apiKeyAuthTag,
      pairingSecret,
    );

    const consumed = await prisma.devicePairingRequest.updateMany({
      where: {
        id: pairing.id,
        status: 'APPROVED',
        deviceId: pairing.deviceId,
      },
      data: {
        status: 'CONSUMED',
        consumedAt: new Date(),
      },
    });

    if (consumed.count !== 1) {
      return {
        status: 'CONSUMED' as const,
      };
    }

    return {
      status: 'APPROVED' as const,
      deviceId: pairing.deviceId,
      apiKey,
    };
  }

  async listPendingPairings() {
    await prisma.devicePairingRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return prisma.devicePairingRequest.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        pairingCode: true,
        hostname: true,
        friendlyName: true,
        launcherVersion: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async approvePairing(
    pairingId: string,
    approvedBy: string,
  ) {
    const pairing = await prisma.devicePairingRequest.findUnique({
      where: { id: pairingId },
    });

    if (!pairing) {
      throw new Error('Pairing request not found');
    }

    if (pairing.status !== 'PENDING') {
      throw new Error(
        `Pairing request is already ${pairing.status}`,
      );
    }

    if (pairing.expiresAt.getTime() <= Date.now()) {
      await prisma.devicePairingRequest.update({
        where: { id: pairing.id },
        data: { status: 'EXPIRED' },
      });

      throw new Error('Pairing request has expired');
    }

    const { rawKey, hash } = generateLauncherApiKey();
    const deviceCode = await generateDeviceCode();

    const device = await prisma.$transaction(async (tx) => {
      const created = await tx.registeredDevice.create({
        data: {
          deviceCode,
          friendlyName:
            pairing.friendlyName ||
            pairing.hostname ||
            deviceCode,
          hostname: pairing.hostname,
          launcherVersion: pairing.launcherVersion,
          launcherApiKeyHash: hash,
          status: 'UNKNOWN',
          enabled: true,
          approvalState: 'APPROVED',
          supportsPlatformLauncher: true,
          createdBy: approvedBy,
        },
      });

      /*
       * The encrypted API-key fields were already created using the
       * pairing secret. The dashboard never receives rawKey.
       */
      await tx.devicePairingRequest.update({
        where: { id: pairing.id },
        data: {
          deviceId: created.id,
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy,
        },
      });

      return created;
    });

    /*
     * rawKey intentionally disappears after this function.
     * It is only recoverable by the launcher presenting the pairing
     * secret to pair/status.
     */
    void rawKey;

    return {
      id: device.id,
      deviceCode: device.deviceCode,
      friendlyName: device.friendlyName,
      hostname: device.hostname,
      launcherVersion: device.launcherVersion,
      status: device.status,
      approvalState: device.approvalState,
      pairingId: pairing.id,
    };
  }

  async rejectPairing(pairingId: string) {
    const pairing = await prisma.devicePairingRequest.findUnique({
      where: { id: pairingId },
    });

    if (!pairing) {
      throw new Error('Pairing request not found');
    }

    if (pairing.status !== 'PENDING') {
      throw new Error(
        `Pairing request is already ${pairing.status}`,
      );
    }

    return prisma.devicePairingRequest.update({
      where: { id: pairing.id },
      data: {
        status: 'REJECTED',
      },
      select: {
        id: true,
        status: true,
      },
    });
  }
}

export const devicePairingService = new DevicePairingService();