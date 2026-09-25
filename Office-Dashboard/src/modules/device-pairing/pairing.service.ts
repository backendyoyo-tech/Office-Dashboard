import crypto from "crypto";
import { PrismaClient, DevicePairingStatus, device_approval_state } from "@prisma/client";

const prisma = new PrismaClient();

const PAIRING_TTL_MINUTES = 15;

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 8; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }

  return code;
}

async function generateUniquePairingCode(): Promise<string> {
  for (;;) {
    const pairingCode = generatePairingCode();

    const existing = await prisma.devicePairingRequest.findUnique({
      where: { pairingCode },
      select: { id: true },
    });

    if (!existing) {
      return pairingCode;
    }
  }
}

function generateLauncherApiKey(): string {
  return `hr_launcher_${randomHex(32)}`;
}

function encryptApiKey(apiKey: string, pairingSecret: string) {
  const key = crypto
    .createHash("sha256")
    .update(pairingSecret, "utf8")
    .digest();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decryptApiKey(
  ciphertext: string,
  iv: string,
  authTag: string,
  pairingSecret: string,
): string {
  const key = crypto
    .createHash("sha256")
    .update(pairingSecret, "utf8")
    .digest();

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function generateUniqueDeviceCode(): Promise<string> {
  for (;;) {
    const deviceCode = `PC-${randomHex(3).toUpperCase()}`;

    const existing = await prisma.registeredDevice.findUnique({
      where: { deviceCode },
      select: { id: true },
    });

    if (!existing) {
      return deviceCode;
    }
  }
}

export async function createPairingRequest(input: {
  hostname?: string | null;
  friendlyName?: string | null;
  launcherVersion?: string | null;
}) {
  const pairingCode = await generateUniquePairingCode();

  const pairingSecret = randomHex(32);
  const secretHash = sha256(pairingSecret);

  /*
   * Generate the API key NOW.
   *
   * The raw key is never stored.
   * Only:
   *   - SHA256 hash
   *   - encrypted raw value
   * are persisted.
   */
  const apiKey = generateLauncherApiKey();
  const apiKeyHash = sha256(apiKey);

  const encrypted = encryptApiKey(apiKey, pairingSecret);

  const expiresAt = new Date(
    Date.now() + PAIRING_TTL_MINUTES * 60 * 1000,
  );

  const request = await prisma.devicePairingRequest.create({
    data: {
      pairingCode,
      secretHash,

      hostname: input.hostname ?? null,
      friendlyName: input.friendlyName ?? null,
      launcherVersion: input.launcherVersion ?? null,

      apiKeyHash,

      apiKeyCiphertext: encrypted.ciphertext,
      apiKeyIv: encrypted.iv,
      apiKeyAuthTag: encrypted.authTag,

      status: DevicePairingStatus.PENDING,
      expiresAt,
    },
    select: {
      id: true,
      pairingCode: true,
      expiresAt: true,
    },
  });

  return {
    pairingId: request.id,
    pairingCode: request.pairingCode,
    pairingSecret,
    expiresAt: request.expiresAt,
  };
}

export async function getPairingStatus(input: {
  pairingId: string;
  pairingSecret: string;
}) {
  const request = await prisma.devicePairingRequest.findUnique({
    where: {
      id: input.pairingId,
    },
  });

  if (!request) {
    throw new Error("PAIRING_NOT_FOUND");
  }

  const suppliedSecretHash = sha256(input.pairingSecret);

  if (
    !crypto.timingSafeEqual(
      Buffer.from(suppliedSecretHash, "hex"),
      Buffer.from(request.secretHash, "hex"),
    )
  ) {
    throw new Error("INVALID_PAIRING_SECRET");
  }

  if (
    request.status === DevicePairingStatus.PENDING &&
    request.expiresAt.getTime() <= Date.now()
  ) {
    await prisma.devicePairingRequest.update({
      where: { id: request.id },
      data: {
        status: DevicePairingStatus.EXPIRED,
      },
    });

    return {
      status: DevicePairingStatus.EXPIRED,
    };
  }

  if (request.status === DevicePairingStatus.PENDING) {
    return {
      status: DevicePairingStatus.PENDING,
    };
  }

  if (request.status === DevicePairingStatus.REJECTED) {
    return {
      status: DevicePairingStatus.REJECTED,
    };
  }

  if (request.status === DevicePairingStatus.EXPIRED) {
    return {
      status: DevicePairingStatus.EXPIRED,
    };
  }

  /*
   * APPROVED -> CONSUMED is intentionally atomic.
   *
   * Only the launcher possessing the pairing secret can decrypt
   * the API key.
   */
  if (request.status === DevicePairingStatus.APPROVED) {
    const apiKey = decryptApiKey(
      request.apiKeyCiphertext,
      request.apiKeyIv,
      request.apiKeyAuthTag,
      input.pairingSecret,
    );

    const consumed = await prisma.devicePairingRequest.updateMany({
      where: {
        id: request.id,
        status: DevicePairingStatus.APPROVED,
      },
      data: {
        status: DevicePairingStatus.CONSUMED,
        consumedAt: new Date(),
      },
    });

    if (consumed.count !== 1) {
      throw new Error("PAIRING_ALREADY_CONSUMED");
    }

    return {
      status: DevicePairingStatus.CONSUMED,
      deviceId: request.deviceId,
      apiKey,
    };
  }

  return {
    status: request.status,
  };
}

export async function listPairingRequests() {
  return prisma.devicePairingRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      pairingCode: true,
      hostname: true,
      friendlyName: true,
      launcherVersion: true,
      deviceId: true,
      status: true,
      expiresAt: true,
      approvedAt: true,
      approvedBy: true,
      consumedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function approvePairingRequest(
  pairingId: string,
  adminUserId: string,
) {
  const request = await prisma.devicePairingRequest.findUnique({
    where: { id: pairingId },
  });

  if (!request) {
    throw new Error("PAIRING_NOT_FOUND");
  }

  if (request.status !== DevicePairingStatus.PENDING) {
    throw new Error("PAIRING_NOT_PENDING");
  }

  if (request.expiresAt.getTime() <= Date.now()) {
    await prisma.devicePairingRequest.update({
      where: { id: request.id },
      data: {
        status: DevicePairingStatus.EXPIRED,
      },
    });

    throw new Error("PAIRING_EXPIRED");
  }

  if (!request.apiKeyHash) {
    throw new Error("PAIRING_API_KEY_HASH_MISSING");
  }

  const deviceCode = await generateUniqueDeviceCode();

  const device = await prisma.registeredDevice.create({
    data: {
      deviceCode,

      friendlyName:
        request.friendlyName ||
        request.hostname ||
        `HairRap PC ${deviceCode}`,

      hostname: request.hostname,
      launcherVersion: request.launcherVersion,

      /*
       * IMPORTANT:
       * This is the SAME hash created when the pairing request
       * was generated.
       */
      launcherApiKeyHash: request.apiKeyHash,

      status: "UNKNOWN",
      enabled: true,

      createdBy: adminUserId,

      approvalState: device_approval_state.APPROVED,

      supportsPlatformLauncher: true,
    },
    select: {
      id: true,
      deviceCode: true,
      friendlyName: true,
      hostname: true,
      launcherVersion: true,
      approvalState: true,
      supportsPlatformLauncher: true,
      createdAt: true,
    },
  });

  const updated = await prisma.devicePairingRequest.updateMany({
    where: {
      id: request.id,
      status: DevicePairingStatus.PENDING,
    },
    data: {
      status: DevicePairingStatus.APPROVED,
      deviceId: device.id,
      approvedAt: new Date(),
      approvedBy: adminUserId,
    },
  });

  if (updated.count !== 1) {
    await prisma.registeredDevice.delete({
      where: { id: device.id },
    });

    throw new Error("PAIRING_APPROVAL_CONFLICT");
  }

  return device;
}

export async function rejectPairingRequest(pairingId: string) {
  const result = await prisma.devicePairingRequest.updateMany({
    where: {
      id: pairingId,
      status: DevicePairingStatus.PENDING,
    },
    data: {
      status: DevicePairingStatus.REJECTED,
    },
  });

  if (result.count !== 1) {
    throw new Error("PAIRING_NOT_PENDING");
  }

  return {
    success: true,
  };
}