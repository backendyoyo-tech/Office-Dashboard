import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(keyVersion?: number): { key: Buffer; version: number } {
  const rawKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
  }
  const version = keyVersion ?? parseInt(process.env.CREDENTIAL_KEY_VERSION ?? '1', 10);
  // Derive key from hex string - must be exactly 32 bytes (256 bits) for AES-256
  const key = Buffer.from(rawKey, 'hex');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return { key, version };
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  nonce: string;      // base64
  authTag: string;    // base64
  keyVersion: number;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Uses platform_account_id as AAD (Additional Authenticated Data)
 * to bind the ciphertext to a specific account.
 */
export function encryptCredential(
  plaintext: string,
  aad: string, // platform_account_id
  keyVersion?: number,
): EncryptedPayload {
  const { key, version } = getEncryptionKey(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  // Bind ciphertext to the platform account
  cipher.setAAD(Buffer.from(aad, 'utf-8'));

  let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    nonce: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion: version,
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * Verifies AAD matches the platform_account_id to prevent
 * ciphertext from being associated with the wrong account.
 */
export function decryptCredential(
  payload: EncryptedPayload,
  aad: string, // platform_account_id
): string {
  const { key } = getEncryptionKey(payload.keyVersion);
  const iv = Buffer.from(payload.nonce, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);
  // Verify AAD binding
  decipher.setAAD(Buffer.from(aad, 'utf-8'));

  let decrypted = decipher.update(payload.ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');

  return decrypted;
}
